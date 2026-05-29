import Anthropic from '@anthropic-ai/sdk'
import type { ParsedBill, ParsedItem } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a receipt parser. Extract bill data from the image and return ONLY a JSON object.

Schema:
{
  "bill_type": "group_order | physical | unknown",
  "persons": [{"name": "...", "items": [{"name": "...", "unit_price": 0, "quantity": 1}], "person_subtotal": 0}],
  "items": [{"name": "...", "unit_price": 0, "quantity": 1}],
  "food_subtotal": 0,
  "delivery_fee": 0,
  "total_discount": 0,
  "grand_total": 0,
  "has_vat": false,
  "vat_amount": 0
}

Rules:
- bill_type "group_order": items already grouped by person (LINE MAN / Shopee Food group orders)
- bill_type "physical": paper/thermal receipt, no person grouping
- For group_order: populate "persons", leave "items" empty
- For physical: populate "items", leave "persons" empty
- delivery_fee = ค่าจัดส่ง NET as POSITIVE number (after any delivery discount applied)
- total_discount = food_subtotal + delivery_fee - grand_total (derive from grand total to capture hidden discounts)
- All prices as numbers only, no ฿ symbol
- Collapsed/hidden person sections (section header visible but items hidden): still include that person with one item named "รายการ" and unit_price = the visible person total, quantity 1
- Receipt may be cut off / partially visible: parse what is visible, set unknown totals to 0
- CRITICAL: respond with ONLY the JSON object. No explanations, no text before or after, no markdown fences`

export async function parseReceiptImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<ParsedBill> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: 'Parse this receipt.' },
        ],
      },
    ],
  })

  let raw = (response.content[0] as { type: 'text'; text: string }).text.trim()
  if (raw.startsWith('```')) {
    raw = raw.split('```')[1].replace(/^json/, '').trim()
  } else if (!raw.startsWith('{')) {
    // Claude added explanation text — find the JSON object
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) raw = match[0]
  }

  const data = JSON.parse(raw) as ParsedBill & Record<string, unknown>

  // Normalize: all monetary fields must be non-negative
  data.food_subtotal = Math.abs(Number(data.food_subtotal) || 0)
  data.delivery_fee = Math.abs(Number(data.delivery_fee) || 0)
  data.grand_total = Math.abs(Number(data.grand_total) || 0)

  // Claude often returns total_discount: 0 even when discounts exist.
  // Always derive from totals — same formula the Python prompt instructs:
  //   total_discount = food_subtotal + delivery_fee - grand_total
  // Also handles old-format responses that return discount_food / discount_general / discount_delivery.
  const derivedDiscount = data.food_subtotal + data.delivery_fee - data.grand_total
  const oldFormatSum =
    Math.abs(Number(data.discount_food) || 0) +
    Math.abs(Number(data.discount_general) || 0) +
    Math.abs(Number(data.discount_delivery) || 0)

  data.total_discount = Math.round(
    Math.max(derivedDiscount, Math.abs(Number(data.total_discount) || 0), oldFormatSum) * 100,
  ) / 100
  if (data.total_discount < 0.01) data.total_discount = 0

  if (!['group_order', 'physical', 'unknown'].includes(data.bill_type)) {
    data.bill_type = 'unknown'
  }

  return data
}

// Port of Python _normalize() — must match exactly to avoid dedup failures on multi-page OCR
// Strip Thai tone marks ็่้๊๋์ํ๎ (็–๎): OCR often misreads these across pages
const THAI_TONE_MARKS = /[็-๎]/g

function normalizeName(name: string): string {
  return name
    .normalize('NFC')          // Unicode NFC — same as Python unicodedata.normalize("NFC")
    .replace(THAI_TONE_MARKS, '') // strip tone marks so OCR errors don't break dedup
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim()
    .toLowerCase()
}

function normalizeItemKey(item: ParsedItem): string {
  return `${normalizeName(item.name)}|${item.unit_price}|${item.quantity}`
}

export function mergeParsedBills(bills: ParsedBill[]): ParsedBill {
  if (bills.length === 1) return bills[0]

  const mergedPersons = new Map<string, { name: string; items: ParsedItem[]; keys: Set<string>; person_subtotal: number }>()
  const mergedItems: ParsedItem[] = []
  const mergedItemKeys = new Set<string>()

  for (const bill of bills) {
    for (const person of bill.persons) {
      // Use normalized name as the map key — same as Python `merged_persons: dict[str, ParsedPerson]`
      // which uses person.name directly (Python _normalize only applied to items, not person keys,
      // but person names should also be deduped case/whitespace insensitively)
      const personKey = normalizeName(person.name)
      if (mergedPersons.has(personKey)) {
        const existing = mergedPersons.get(personKey)!
        for (const item of person.items) {
          const key = normalizeItemKey(item)
          if (!existing.keys.has(key)) {
            existing.items.push(item)
            existing.keys.add(key)
          }
        }
        existing.person_subtotal = existing.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
      } else {
        mergedPersons.set(personKey, {
          name: person.name,           // keep original display name from first page
          items: [...person.items],
          keys: new Set(person.items.map(normalizeItemKey)),
          person_subtotal: person.person_subtotal,
        })
      }
    }

    for (const item of bill.items) {
      const key = normalizeItemKey(item)
      if (!mergedItemKeys.has(key)) {
        mergedItems.push(item)
        mergedItemKeys.add(key)
      }
    }
  }

  const foodSubtotal = Math.max(...bills.map(b => b.food_subtotal))
  const deliveryFee = Math.max(...bills.map(b => b.delivery_fee))
  const vatAmount = Math.max(...bills.map(b => b.vat_amount))
  const hasVat = bills.some(b => b.has_vat)
  const nonzeroTotals = bills.map(b => b.grand_total).filter(t => t > 0)
  const grandTotal = nonzeroTotals.length > 0 ? Math.min(...nonzeroTotals) : 0

  return {
    bill_type: bills[0].bill_type,
    persons: [...mergedPersons.values()].map(p => {
      // Drop zero-price placeholder items when real items exist (from cut-off pages)
      const realItems = p.items.filter(i => i.unit_price > 0)
      const finalItems = realItems.length > 0 ? realItems : p.items
      return {
        name: p.name,
        items: finalItems,
        person_subtotal: finalItems.reduce((s, i) => s + i.unit_price * i.quantity, 0),
      }
    }),
    items: mergedItems,
    food_subtotal: foodSubtotal,
    delivery_fee: deliveryFee,
    total_discount: 0,
    grand_total: grandTotal,
    has_vat: hasVat,
    vat_amount: vatAmount,
  }
}
