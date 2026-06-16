import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const db = createServerClient()

  const { data, error } = await db
    .from('sessions')
    .select('*, items(*, assignments(*))')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const db = createServerClient()

  const allowed = ['status', 'bill_type', 'split_mode', 'food_subtotal', 'delivery_fee', 'total_discount', 'grand_total', 'ocr_raw', 'extra_charges', 'thai_help_enabled', 'thai_help_balance', 'thai_help_amount']
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { data, error } = await db
    .from('sessions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const db = createServerClient()

  const { error } = await db.from('sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
