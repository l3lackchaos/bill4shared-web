import type { BillItem, ItemAssignment, PersonTotal, SplitResult, SplitMode } from '@/types'

interface SessionData {
  id: string
  split_mode: SplitMode
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  grand_total: number
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
      verified: true,
    }
  }

  const foodSubtotal = [...personFood.values()].reduce((s, v) => s + v, 0)
  const n = personFood.size
  const { delivery_fee, total_discount, split_mode: mode } = session

  const persons: PersonTotal[] = []

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

    persons.push({
      display_name: displayName,
      food_amount: round2(food),
      discount_received: round2(discount),
      delivery_share: round2(delivery),
      total: round2(food - discount + delivery),
    })
  }

  persons.sort((a, b) => b.food_amount - a.food_amount)

  const calcTotal = persons.reduce((s, p) => s + p.total, 0)
  const verified = Math.abs(calcTotal - session.grand_total) < 0.10

  return {
    session_id: session.id,
    split_mode: mode,
    persons,
    grand_total: session.grand_total,
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
