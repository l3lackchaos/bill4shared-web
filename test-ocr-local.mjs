import { readFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

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

async function parse(imgPath) {
  const data = readFileSync(imgPath).toString('base64')
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
        { type: 'text', text: 'Parse this receipt.' },
      ]
    }]
  })
  let raw = resp.content[0].text.trim()
  if (raw.startsWith('```')) {
    raw = raw.split('```')[1].replace(/^json/, '').trim()
  } else if (!raw.startsWith('{')) {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) raw = match[0]
  }
  return JSON.parse(raw)
}

function printBill(label, b) {
  console.log(`\n=== ${label} ===`)
  for (const p of b.persons) {
    console.log(' ', p.name, '(sub:', p.person_subtotal, ')')
    for (const i of p.items) console.log('    -', i.name, 'x'+i.quantity, '@', i.unit_price)
  }
  console.log('food=%s delivery=%s discount=%s grand=%s', b.food_subtotal, b.delivery_fee, b.total_discount, b.grand_total)
}

// Inline merge (mirrors lib/ocr.ts mergeParsedBills)
function normalizeName(name) {
  return name.normalize('NFC').replace(/[็-๎]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}
function normalizeItemKey(item) {
  return `${normalizeName(item.name)}|${item.unit_price}|${item.quantity}`
}

function merge(bills) {
  if (bills.length === 1) return bills[0]
  const mergedPersons = new Map()
  const mergedItems = [], mergedItemKeys = new Set()
  for (const bill of bills) {
    for (const person of bill.persons) {
      const personKey = normalizeName(person.name)
      if (mergedPersons.has(personKey)) {
        const ex = mergedPersons.get(personKey)
        for (const item of person.items) {
          const key = normalizeItemKey(item)
          if (!ex.keys.has(key)) { ex.items.push(item); ex.keys.add(key) }
        }
      } else {
        mergedPersons.set(personKey, { name: person.name, items: [...person.items], keys: new Set(person.items.map(normalizeItemKey)) })
      }
    }
    for (const item of bill.items) {
      const key = normalizeItemKey(item)
      if (!mergedItemKeys.has(key)) { mergedItems.push(item); mergedItemKeys.add(key) }
    }
  }
  const foodSubtotal = Math.max(...bills.map(b => b.food_subtotal))
  const deliveryFee = Math.max(...bills.map(b => b.delivery_fee))
  const nonzero = bills.map(b => b.grand_total).filter(t => t > 0)
  const grandTotal = nonzero.length > 0 ? Math.min(...nonzero) : 0
  const derivedDiscount = foodSubtotal + deliveryFee - grandTotal
  return {
    bill_type: bills[0].bill_type,
    persons: [...mergedPersons.values()].map(p => {
      const realItems = p.items.filter(i => i.unit_price > 0)
      const finalItems = realItems.length > 0 ? realItems : p.items
      return { name: p.name, items: finalItems, person_subtotal: finalItems.reduce((s,i)=>s+i.unit_price*i.quantity,0) }
    }),
    items: mergedItems, food_subtotal: foodSubtotal, delivery_fee: deliveryFee,
    total_discount: Math.round(Math.max(derivedDiscount, 0) * 100) / 100,
    grand_total: grandTotal,
  }
}

const b1 = await parse('./bill-example/1/S__20037640_0.jpg')
printBill('PAGE 1', b1)

const b2 = await parse('./bill-example/1/S__20037641_0.jpg')
printBill('PAGE 2', b2)

const merged = merge([b1, b2])
printBill('MERGED', merged)
