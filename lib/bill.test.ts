import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateSplit, computeThaiHelp, sumExtraCharges, reconcileItems } from './bill'
import type { BillItem, ItemAssignment } from '@/types'

// Build an item with assignments. share is given as [num, den] per person.
function item(
  id: string,
  unit_price: number,
  quantity: number,
  people: { name: string; num?: number; den?: number }[],
): BillItem & { assignments: ItemAssignment[] } {
  return {
    id,
    session_id: 's',
    name: id,
    unit_price,
    quantity,
    pre_assigned_name: null,
    assignments: people.map((p, i) => ({
      id: `${id}-${i}`,
      item_id: id,
      display_name: p.name,
      share_numerator: p.num ?? 1,
      share_denominator: p.den ?? 1,
    })),
  }
}

const base = {
  id: 's',
  food_subtotal: 0,
  delivery_fee: 0,
  total_discount: 0,
  grand_total: 0,
}

const sumPaid = (r: { persons: { total: number }[] }) =>
  Math.round(r.persons.reduce((s, p) => s + p.total, 0) * 100) / 100

// ── equal split ────────────────────────────────────────────────────────────
test('equal split: two people share one item evenly', () => {
  const items = [item('a', 100, 1, [{ name: 'A', num: 1, den: 2 }, { name: 'B', num: 1, den: 2 }])]
  const r = calculateSplit({ ...base, split_mode: 2, grand_total: 100 }, items)
  const by = Object.fromEntries(r.persons.map(p => [p.display_name, p.total]))
  assert.equal(by.A, 50)
  assert.equal(by.B, 50)
  assert.ok(r.verified)
})

// ── custom price (ฝาก A สั่ง) ────────────────────────────────────────────────
test('custom price: uneven per-person amounts reconstruct exactly', () => {
  // item 118; A pays 80, B pays 38 → num=amount*100, den=total*100
  const items = [item('a', 118, 1, [
    { name: 'A', num: 8000, den: 11800 },
    { name: 'B', num: 3800, den: 11800 },
  ])]
  const r = calculateSplit({ ...base, split_mode: 2, grand_total: 118 }, items)
  const by = Object.fromEntries(r.persons.map(p => [p.display_name, p.total]))
  assert.equal(by.A, 80)
  assert.equal(by.B, 38)
})

// ── split modes for discount + delivery ──────────────────────────────────────
test('mode 3 splits discount and delivery equally per head', () => {
  const items = [
    item('a', 200, 1, [{ name: 'A' }]),
    item('b', 100, 1, [{ name: 'B' }]),
  ]
  const r = calculateSplit(
    { ...base, split_mode: 3, food_subtotal: 300, delivery_fee: 40, total_discount: 0, grand_total: 340 },
    items,
  )
  const by = Object.fromEntries(r.persons.map(p => [p.display_name, p.delivery_share]))
  assert.equal(by.A, 20)
  assert.equal(by.B, 20)
  assert.equal(sumPaid(r), 340)
})

test('mode 2 splits delivery equally, discount by food ratio', () => {
  const items = [
    item('a', 200, 1, [{ name: 'A' }]),
    item('b', 100, 1, [{ name: 'B' }]),
  ]
  const r = calculateSplit(
    { ...base, split_mode: 2, food_subtotal: 300, delivery_fee: 30, total_discount: 30, grand_total: 300 },
    items,
  )
  const by = Object.fromEntries(r.persons.map(p => [p.display_name, p]))
  assert.equal(by.A.delivery_share, 15) // equal
  assert.equal(by.B.delivery_share, 15)
  assert.equal(by.A.discount_received, 20) // 200/300 of 30
  assert.equal(by.B.discount_received, 10)
  assert.equal(sumPaid(r), 300)
})

// ── extra charges ────────────────────────────────────────────────────────────
test('sumExtraCharges separates fees and discounts', () => {
  const r = sumExtraCharges([
    { label: 'service', amount: 30, kind: 'fee' },
    { label: 'box', amount: 10, kind: 'fee' },
    { label: 'coupon', amount: 20, kind: 'discount' },
  ])
  assert.deepEqual(r, { fees: 40, discounts: 20 })
})

test('extra charges fold into delivery/discount buckets and reconcile', () => {
  const items = [
    item('a', 200, 1, [{ name: 'A' }]),
    item('b', 100, 1, [{ name: 'B' }]),
  ]
  const r = calculateSplit(
    {
      ...base, split_mode: 2, food_subtotal: 300, grand_total: 320,
      extra_charges: [
        { label: 'service', amount: 30, kind: 'fee' },
        { label: 'box', amount: 10, kind: 'fee' },
        { label: 'coupon', amount: 20, kind: 'discount' },
      ],
    },
    items,
  )
  assert.equal(sumPaid(r), 320) // 300 + 40 fees − 20 discount
})

// ── ไทยช่วยไทย ───────────────────────────────────────────────────────────────
test('computeThaiHelp caps at 60%, ฿200, and the entered balance', () => {
  assert.equal(computeThaiHelp(200, 200), 120) // 60% of 200
  assert.equal(computeThaiHelp(400, 200), 200) // capped at 200
  assert.equal(computeThaiHelp(300, 100), 100) // capped at balance
  assert.equal(computeThaiHelp(0, 1000), 0)
})

test('thai help base is (food − discount), excludes delivery, splits by mode', () => {
  const items = [
    item('a', 200, 1, [{ name: 'A' }]),
    item('b', 100, 1, [{ name: 'B' }]),
  ]
  // food 300, discount 0, delivery 50, balance huge → help = 60% of 300 = 180
  const r = calculateSplit(
    {
      ...base, split_mode: 1, food_subtotal: 300, delivery_fee: 50, grand_total: 350,
      thai_help_enabled: true, thai_help_balance: 1000,
    },
    items,
  )
  assert.equal(r.thai_help_amount, 180)
  assert.equal(r.net_payable, 170) // 350 − 180
  assert.equal(sumPaid(r), 170)
  // mode 1 → by food ratio: A gets 2/3 of 180 = 120
  const by = Object.fromEntries(r.persons.map(p => [p.display_name, p.thai_help_received]))
  assert.equal(by.A, 120)
  assert.equal(by.B, 60)
})

test('thai help base subtracts only the food discount, not a delivery discount', () => {
  const items = [item('a', 325, 1, [{ name: 'A' }])]
  // food 325, total_discount 10 but it's a DELIVERY discount (food_discount 0)
  // → base stays 325 → subsidy = 60% × 325 = 195
  const r = calculateSplit(
    {
      ...base, split_mode: 2, food_subtotal: 325, delivery_fee: 47, total_discount: 10,
      food_discount: 0, grand_total: 362,
      thai_help_enabled: true, thai_help_balance: 10000,
    },
    items,
  )
  assert.equal(r.thai_help_amount, 195)
})

test('thai help base subtracts a food discount', () => {
  const items = [item('a', 325, 1, [{ name: 'A' }])]
  // same numbers but the 10 IS a food discount → base 315 → 60% = 189
  const r = calculateSplit(
    {
      ...base, split_mode: 2, food_subtotal: 325, delivery_fee: 47, total_discount: 10,
      food_discount: 10, grand_total: 362,
      thai_help_enabled: true, thai_help_balance: 10000,
    },
    items,
  )
  assert.equal(r.thai_help_amount, 189)
})

test('thai help disabled → no subsidy', () => {
  const items = [item('a', 100, 1, [{ name: 'A' }])]
  const r = calculateSplit(
    { ...base, split_mode: 2, food_subtotal: 100, grand_total: 100, thai_help_enabled: false, thai_help_balance: 1000 },
    items,
  )
  assert.equal(r.thai_help_amount, 0)
  assert.equal(r.net_payable, 100)
})

// ── reconcile ────────────────────────────────────────────────────────────────
test('reconcileItems flags a duplicated row', () => {
  const r = reconcileItems([{ unit_price: 105, quantity: 1 }, { unit_price: 105, quantity: 1 }], 105)
  assert.equal(r.balanced, false)
  assert.equal(r.diff, 105)
})

test('reconcileItems balances when items match the footer', () => {
  const r = reconcileItems([{ unit_price: 100, quantity: 2 }], 200)
  assert.ok(r.balanced)
})

test('reconcileItems skips the check when the footer is unknown (0)', () => {
  const r = reconcileItems([{ unit_price: 100, quantity: 1 }], 0)
  assert.ok(r.balanced)
})

// ── edge cases ───────────────────────────────────────────────────────────────
test('no assignments → empty result, verified', () => {
  const r = calculateSplit({ ...base, split_mode: 2, grand_total: 0 }, [])
  assert.deepEqual(r.persons, [])
  assert.ok(r.verified)
})
