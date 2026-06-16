import { createServerClient } from '@/lib/supabase-server'
import { calculateSplit } from '@/lib/bill'
import type { BillItem, ItemAssignment, SplitMode, ExtraCharge, SplitResult } from '@/types'

export interface PersonItemShare {
  id: string
  name: string
  unit_price: number
  quantity: number
  share: number
}

export interface SummaryData {
  session: Record<string, unknown> & {
    split_mode: number
    grand_total: number
    food_subtotal: number
    delivery_fee: number
    total_discount: number
  }
  result: SplitResult
  extraCharges: ExtraCharge[]
  personItems: Map<string, PersonItemShare[]>
}

// Shared loader for both the editable summary and the read-only share page, so
// the split math and per-person breakdown stay identical. Returns null when the
// session doesn't exist.
export async function loadSummary(id: string): Promise<SummaryData | null> {
  const db = createServerClient()

  const { data: session } = await db.from('sessions').select('*').eq('id', id).single()
  if (!session) return null

  const { data: items } = await db
    .from('items')
    .select('*, assignments(*)')
    .eq('session_id', id)

  type RawItem = BillItem & { assignments: ItemAssignment[] }
  const normalised = ((items ?? []) as RawItem[]).map(item => ({
    ...item,
    pre_assigned_name: (item as unknown as { pre_assigned_name: string | null }).pre_assigned_name ?? null,
    assignments: item.assignments ?? [],
  }))

  const result = calculateSplit(
    {
      id: session.id,
      split_mode: session.split_mode as SplitMode,
      food_subtotal: Number(session.food_subtotal),
      delivery_fee: Number(session.delivery_fee),
      total_discount: Number(session.total_discount),
      grand_total: Number(session.grand_total),
      extra_charges: session.extra_charges ?? [],
      thai_help_enabled: Boolean(session.thai_help_enabled),
      thai_help_balance: Number(session.thai_help_balance ?? 0),
    },
    normalised,
  )

  const personItems = new Map<string, PersonItemShare[]>()
  for (const item of normalised) {
    const itemTotal = item.unit_price * item.quantity
    for (const a of item.assignments) {
      const shareAmt = itemTotal * (a.share_numerator / a.share_denominator)
      const list = personItems.get(a.display_name) ?? []
      list.push({ id: item.id, name: item.name, unit_price: item.unit_price, quantity: item.quantity, share: shareAmt })
      personItems.set(a.display_name, list)
    }
  }

  return {
    session,
    result,
    extraCharges: (session.extra_charges ?? []) as ExtraCharge[],
    personItems,
  }
}
