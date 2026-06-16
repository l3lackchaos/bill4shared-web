import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

// POST body:
//   { auto_from_preassigned: true }  — for group_order: auto-create assignments from pre_assigned_name
//   { assignments: { item_id, display_name, share_numerator?, share_denominator? }[] }  — manual
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const db = createServerClient()

  if (body.auto_from_preassigned) {
    const { data: items } = await db
      .from('items')
      .select('id, pre_assigned_name')
      .eq('session_id', id)
      .not('pre_assigned_name', 'is', null)

    if (items && items.length > 0) {
      const itemIds = items.map((i: { id: string }) => i.id)
      await db.from('assignments').delete().in('item_id', itemIds)
      await db.from('assignments').insert(
        (items as { id: string; pre_assigned_name: string }[]).map(i => ({
          item_id: i.id,
          display_name: i.pre_assigned_name,
          share_numerator: 1,
          share_denominator: 1,
        })),
      )
    }
    return NextResponse.json({ ok: true })
  }

  // Manual assignment
  const { data: allItems } = await db
    .from('items')
    .select('id')
    .eq('session_id', id)

  const sessionItemIds = new Set((allItems ?? []).map((i: { id: string }) => i.id))

  const incoming = (body.assignments ?? []) as {
    item_id: string
    display_name: string
    share_numerator?: number
    share_denominator?: number
  }[]

  const invalid = incoming.filter(a => !sessionItemIds.has(a.item_id))
  if (invalid.length > 0) {
    return NextResponse.json({ error: 'item_id not in session' }, { status: 400 })
  }

  // Make this save authoritative: clear ALL assignments for the session's items,
  // then insert the incoming set. Deleting only the items present in the payload
  // left stale rows on items the user cleared during a re-edit (everyone removed
  // → that item_id is absent from incoming → its old assignments survived).
  const allItemIds = [...sessionItemIds]
  if (allItemIds.length > 0) {
    await db.from('assignments').delete().in('item_id', allItemIds)
  }

  if (incoming.length > 0) {
    const { error } = await db.from('assignments').insert(
      incoming.map(a => ({
        item_id: a.item_id,
        display_name: a.display_name,
        share_numerator: a.share_numerator ?? 1,
        share_denominator: a.share_denominator ?? 1,
      })),
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
