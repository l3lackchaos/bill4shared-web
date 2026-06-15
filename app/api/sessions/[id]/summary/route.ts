import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { calculateSplit } from '@/lib/bill'
import type { BillItem, ItemAssignment, SplitMode } from '@/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const db = createServerClient()

  const { data: session, error: sErr } = await db
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 404 })

  const { data: items, error: iErr } = await db
    .from('items')
    .select('*, assignments(*)')
    .eq('session_id', id)

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

  type RawItem = BillItem & { assignments: ItemAssignment[] }
  const normalised = (items as RawItem[]).map(item => ({
    ...item,
    assignments: item.assignments ?? [],
  }))

  const result = calculateSplit(
    {
      id: session.id,
      split_mode: session.split_mode as SplitMode,
      food_subtotal: session.food_subtotal,
      delivery_fee: session.delivery_fee,
      total_discount: session.total_discount,
      grand_total: session.grand_total,
      thai_help_enabled: Boolean(session.thai_help_enabled),
      thai_help_balance: Number(session.thai_help_balance ?? 0),
    },
    normalised,
  )

  return NextResponse.json(result)
}
