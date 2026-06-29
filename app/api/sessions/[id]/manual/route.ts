import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { rateLimitGuard } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }

type ManualItem = { name: string; unit_price: number; quantity: number }

export async function POST(req: Request, { params }: Params) {
  const limited = rateLimitGuard(req, 'manual', 20, 60_000)
  if (limited) return limited

  const { id } = await params
  const body = await req.json()
  const items: ManualItem[] = Array.isArray(body.items) ? body.items : []
  const deliveryFee = Number(body.delivery_fee) || 0
  const totalDiscount = Number(body.total_discount) || 0

  const validItems = items
    .map(item => ({
      name: String(item.name ?? '').trim(),
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 1,
    }))
    .filter(item => item.name.length > 0 && item.unit_price > 0)

  if (validItems.length === 0) {
    return NextResponse.json({ error: 'No valid items provided' }, { status: 400 })
  }

  const foodSubtotal = validItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const grandTotal = foodSubtotal + deliveryFee - totalDiscount

  const db = createServerClient()

  await db.from('items').delete().eq('session_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.from('items').insert(validItems.map(item => ({
    session_id: id,
    name: item.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    pre_assigned_name: null,
  })) as any)

  const { data, error } = await db
    .from('sessions')
    .update({
      bill_type: 'typed',
      food_subtotal: foodSubtotal,
      delivery_fee: deliveryFee,
      total_discount: totalDiscount,
      grand_total: grandTotal,
      ocr_raw: null,
      status: 'confirming',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
