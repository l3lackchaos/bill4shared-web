import type { BillItem, ItemAssignment, PersonTotal, SplitResult, SplitMode, ExtraCharge } from '@/types'
import { THAI_HELP_RATE, THAI_HELP_CAP } from '@/types'

interface SessionData {
  id: string
  split_mode: SplitMode
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  grand_total: number
  extra_charges?: ExtraCharge[]
  thai_help_enabled?: boolean
  thai_help_balance?: number // remaining subsidy balance the user entered for this bill
}

// Sum extra charges into fee/discount totals. Fees join delivery, discounts join
// total_discount, so they ride the existing split_mode math unchanged.
export function sumExtraCharges(charges: ExtraCharge[] = []): { fees: number; discounts: number } {
  let fees = 0
  let discounts = 0
  for (const c of charges) {
    const amt = Math.abs(Number(c.amount) || 0)
    if (c.kind === 'discount') discounts += amt
    else fees += amt
  }
  return { fees: round2(fees), discounts: round2(discounts) }
}

/**
 * ไทยช่วยไทย subsidy for a given payable amount.
 * State covers THAI_HELP_RATE of the bill, up to THAI_HELP_CAP per bill.
 * `available` (the wallet balance) further caps it when provided.
 */
export function computeThaiHelp(payable: number, available = Infinity): number {
  if (payable <= 0) return 0
  const raw = Math.min(payable * THAI_HELP_RATE, THAI_HELP_CAP, available)
  return Math.max(0, round2(raw))
}

export function calculateSplit(
  session: SessionData,
  items: (BillItem & { assignments: ItemAssignment[] })[],
): SplitResult {
  const personFood = new Map<string, number>()

  for (const item of items) {
    const itemTotal = item.unit_price * item.quantity
    for (const a of item.assignments) {
      const share = itemTotal * (a.share_numerator / a.share_denominator)
      personFood.set(a.display_name, (personFood.get(a.display_name) ?? 0) + share)
    }
  }

  if (personFood.size === 0) {
    return {
      session_id: session.id,
      split_mode: session.split_mode,
      persons: [],
      grand_total: session.grand_total,
      thai_help_amount: 0,
      net_payable: session.grand_total,
      verified: true,
    }
  }

  const foodSubtotal = [...personFood.values()].reduce((s, v) => s + v, 0)
  const n = personFood.size
  const { split_mode: mode } = session

  // Fold custom extra charges into the fee/discount buckets so they split with
  // the same mode logic: fees add to delivery, discounts add to total_discount.
  const extra = sumExtraCharges(session.extra_charges)
  const delivery_fee = round2(session.delivery_fee + extra.fees)
  const total_discount = round2(session.total_discount + extra.discounts)

  // ไทยช่วยไทย: a SEPARATE layer from the shop discount. Its base is
  // (food − discount) only — delivery is never subsidised. Apply the shop
  // discount first, THEN compute the subsidy on that net-food figure:
  //   subsidy = min(60% × (food − discount), ฿200, balance entered)
  // Spread across people in proportion to what each one pays before subsidy.
  const thaiHelpBase = Math.max(0, round2(foodSubtotal - total_discount))
  const thaiHelp = session.thai_help_enabled
    ? computeThaiHelp(thaiHelpBase, session.thai_help_balance ?? 0)
    : 0

  // First pass: each person's pre-subsidy total (food − discount + delivery).
  const preTotals = new Map<string, { food: number; discount: number; delivery: number; pre: number }>()
  let preSum = 0
  for (const [displayName, food] of personFood) {
    const ratio = foodSubtotal > 0 ? food / foodSubtotal : 0

    let discount: number
    let delivery: number

    if (mode === 1) {
      discount = ratio * total_discount
      delivery = ratio * delivery_fee
    } else if (mode === 2) {
      discount = ratio * total_discount
      delivery = delivery_fee / n
    } else {
      discount = total_discount / n
      delivery = delivery_fee / n
    }

    const pre = food - discount + delivery
    preTotals.set(displayName, { food, discount, delivery, pre })
    preSum += pre
  }

  const persons: PersonTotal[] = []
  for (const [displayName, t] of preTotals) {
    // Each person's slice of the subsidy is proportional to their pre-subsidy total.
    const helpShare = preSum > 0 ? thaiHelp * (t.pre / preSum) : 0
    persons.push({
      display_name: displayName,
      food_amount: round2(t.food),
      discount_received: round2(t.discount),
      delivery_share: round2(t.delivery),
      thai_help_received: round2(helpShare),
      total: round2(t.pre - helpShare),
    })
  }

  persons.sort((a, b) => b.food_amount - a.food_amount)

  const netPayable = round2(session.grand_total - thaiHelp)
  const calcTotal = persons.reduce((s, p) => s + p.total, 0)
  const verified = Math.abs(calcTotal - netPayable) < 0.10

  return {
    session_id: session.id,
    split_mode: mode,
    persons,
    grand_total: session.grand_total,
    thai_help_amount: thaiHelp,
    net_payable: netPayable,
    verified,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface ItemsReconcile {
  itemsTotal: number        // Σ unit_price × quantity over all parsed items
  foodSubtotal: number      // ค่าอาหาร read from the receipt footer
  diff: number              // itemsTotal − foodSubtotal (>0 likely duplicate, <0 likely missing)
  balanced: boolean         // |diff| within tolerance → item list trusted
}

/**
 * Cross-check the parsed item list against the receipt's own ค่าอาหาร line.
 *
 * These are two independent figures: the sum of what we extracted vs. the
 * subtotal the merchant printed. On a clean parse they match. A mismatch is a
 * strong signal of a multi-image merge problem — a person/item counted twice
 * (diff > 0) or dropped (diff < 0) — even when grand_total looks fine. This is
 * exactly the case where two people order the same-priced item and a collapsed
 * section can't be name-matched, so the row gets double-counted.
 *
 * foodSubtotal ≤ 0 means the footer wasn't read; there's nothing to compare to,
 * so we report balanced and let the grand_total check be the safety net.
 */
export function reconcileItems(
  items: { unit_price: number; quantity: number }[],
  foodSubtotal: number,
  tolerance = 0.5,
): ItemsReconcile {
  const itemsTotal = round2(items.reduce((s, i) => s + i.unit_price * i.quantity, 0))
  const food = round2(foodSubtotal)
  const diff = round2(itemsTotal - food)
  const balanced = food <= 0 || Math.abs(diff) <= tolerance
  return { itemsTotal, foodSubtotal: food, diff, balanced }
}
