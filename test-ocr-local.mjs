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

Physical / paper receipt rules (POS, restaurant, McDonald's, Café, etc.):
- grand_total = the amount ACTUALLY PAID. Use the line that equals the payment/
  tender (Total, ยอดชำระ, Eat-In Total, Amount Paid, or the card/cash line such
  as Visa/Cash). It is usually the LARGEST money figure on the receipt.
- VAT IS NOT A DISCOUNT. On "VAT included / incl Tax" receipts the price already
  contains tax. Lines like "Net Total" / "ยอดก่อนภาษี" (pre-tax) and
  "Tax Included" / "ภาษี 7%" are a breakdown of the SAME total — never subtract
  them. Set has_vat=true and vat_amount=the tax figure, but do NOT let the
  pre-tax (Net) figure become grand_total, or a phantom discount appears.
  Example: Subtotal 294, Net Total 274.77, Tax Included 19.23, Visa 294
           => grand_total=294, food_subtotal=294, vat_amount=19.23, total_discount=0.
- food_subtotal = sum of item line totals (the Subtotal line before any real
  discount). If the only difference from grand_total is tax, they are equal.
- Only count a real discount line (ส่วนลด / Discount / Promotion / coupon) toward
  a lower grand_total. Rounding Adjustment is not a discount.
- Item amounts: the printed price column is the LINE total. If quantity > 1,
  unit_price = line total / quantity. Merge an item that wraps onto a second line
  (e.g. "3 pcs. McPatongo with 1" + "Condensed milk Dip") into ONE item name.
  Skip non-item lines (Subtotal, Total, Tax, Rounding, Change, card info).

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

// Inline merge — MUST mirror lib/ocr.ts mergeParsedBills exactly.
const ROLE_PREFIX = /\[[^\]]*\]/g
function cleanPersonName(name) {
  return name.replace(ROLE_PREFIX, '').replace(/\s+/g, ' ').trim()
}
function normalizeName(name) {
  return name.normalize('NFC').replace(ROLE_PREFIX, '').replace(/[็-๎]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}
function normalizeItemKey(item) {
  return `${normalizeName(item.name)}|${item.unit_price}|${item.quantity}`
}

function merge(bills) {
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
        mergedPersons.set(personKey, { name: cleanPersonName(person.name), items: [...person.items], keys: new Set(person.items.map(normalizeItemKey)) })
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

  const mergedPersonList = [...mergedPersons.values()].map(p => {
    const realItems = p.items.filter(i => i.unit_price > 0 && i.name !== 'รายการ')
    const finalItems = realItems.length > 0 ? realItems : p.items
    return { name: p.name, items: finalItems, person_subtotal: finalItems.reduce((s,i)=>s+i.unit_price*i.quantity,0) }
  })
  const billType = mergedPersonList.length > 0 ? 'group_order' : mergedItems.length > 0 ? 'physical' : 'unknown'
  const totalDiscount = grandTotal > 0 ? Math.round(Math.max(0, foodSubtotal + deliveryFee - grandTotal) * 100) / 100 : 0

  return {
    bill_type: billType,
    persons: mergedPersonList,
    items: mergedItems, food_subtotal: foodSubtotal, delivery_fee: deliveryFee,
    total_discount: totalDiscount,
    grand_total: grandTotal,
  }
}

// reconcileItems — mirror of lib/bill.ts
function reconcileItems(items, foodSubtotal, tolerance = 0.5) {
  const round2 = n => Math.round(n * 100) / 100
  const itemsTotal = round2(items.reduce((s, i) => s + i.unit_price * i.quantity, 0))
  const food = round2(foodSubtotal)
  const diff = round2(itemsTotal - food)
  return { itemsTotal, foodSubtotal: food, diff, balanced: food <= 0 || Math.abs(diff) <= tolerance }
}

// Verify against all example bills (each is a 2-page LINE MAN group order).
// expectBalanced: do we expect Σ items to match the ค่าอาหาร footer after merge?
//   bills 1 & 2 parse cleanly → balanced. bill 3 has a collapsed section whose
//   name can't be matched across pages → a same-priced row double-counts, so the
//   reconcile detector SHOULD flag it (balanced === false is the correct result).
const BILLS = [
  { label: '1', p1: './bill-example/1/S__20037640_0.jpg', p2: './bill-example/1/S__20037641_0.jpg', expectBalanced: true },
  { label: '2', p1: './bill-example/2/S__20037642_0.jpg', p2: './bill-example/2/S__20037645_0.jpg', expectBalanced: true },
  { label: '3', p1: './bill-example/3/S__20439049_0.jpg', p2: './bill-example/3/S__20439050_0.jpg', expectBalanced: false },
]

let failures = 0
for (const { label, p1, p2, expectBalanced } of BILLS) {
  console.log(`\n############ BILL ${label} ############`)
  const b1 = await parse(p1); printBill('PAGE 1', b1)
  const b2 = await parse(p2); printBill('PAGE 2', b2)
  const merged = merge([b1, b2]); printBill('MERGED', merged)

  const allItems = merged.persons.flatMap(p => p.items).concat(merged.items)
  const rec = reconcileItems(allItems, merged.food_subtotal)
  const dupNames = merged.persons.map(p => p.name)
  const hasDup = new Set(dupNames).size !== dupNames.length

  // Assertions:
  //  - discount must be derived (never silently 0 when a grand_total was read)
  //  - no duplicate person names after merge (dedup + role-prefix cleaning work)
  //  - reconcile.balanced matches expectation
  const checks = [
    ['discount derived', merged.grand_total === 0 || merged.total_discount > 0],
    ['no dup persons', !hasDup],
    [`reconcile balanced === ${expectBalanced}`, rec.balanced === expectBalanced],
  ]
  console.log(`RECONCILE: Σitems=${rec.itemsTotal} food=${rec.foodSubtotal} diff=${rec.diff} balanced=${rec.balanced}`)
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`)
    if (!ok) failures++
  }
}

// ── Physical / paper receipts (single image) ──────────────────────────────
// Drop any paper-receipt photos into bill-example/4/ and they'll be parsed here.
// Physical bills are VAT-inclusive POS slips: grand_total must be the amount
// PAID (not the pre-tax Net Total), and VAT must NOT become a phantom discount.
import { existsSync, readdirSync } from 'fs'

const PHYS_DIR = './bill-example/4'
if (existsSync(PHYS_DIR)) {
  const files = readdirSync(PHYS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  for (const file of files) {
    console.log(`\n############ PHYSICAL: ${file} ############`)
    const b = await parse(`${PHYS_DIR}/${file}`)
    printBill('PARSED', b)
    const merged = merge([b]) // run through the same pipeline (cleanup + derive)
    printBill('NORMALIZED', merged)

    const allItems = merged.persons.flatMap(p => p.items).concat(merged.items)
    const rec = reconcileItems(allItems, merged.food_subtotal)
    // grand_total should equal the items sum on a VAT-inclusive bill with no real
    // discount (VAT is inside the price, not subtracted).
    const discountIsTax = merged.total_discount > 0 &&
      Math.abs(merged.total_discount - (merged.vat_amount ?? 0)) < 0.5

    const checks = [
      ['has items', allItems.length > 0],
      ['grand_total looks like amount paid (≥ Σitems-ish)', merged.grand_total >= rec.itemsTotal - 0.5],
      ['VAT not treated as a discount', !discountIsTax],
      ['reconcile balanced (items ≈ food)', rec.balanced],
    ]
    console.log(`RECONCILE: Σitems=${rec.itemsTotal} food=${rec.foodSubtotal} grand=${merged.grand_total} discount=${merged.total_discount} vat=${b.vat_amount ?? 0}`)
    for (const [name, ok] of checks) {
      console.log(`  ${ok ? '✅' : '⚠️ '} ${name}`)
      if (!ok) failures++
    }
  }
} else {
  console.log(`\n(skip physical: create ${PHYS_DIR}/ and add a receipt photo to test)`)
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
