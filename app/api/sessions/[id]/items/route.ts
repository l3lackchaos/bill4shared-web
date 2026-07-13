import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { rateLimitGuard } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }

type ItemPatch = { id: string; unit_price?: number; quantity?: number; name?: string }

// PATCH body: { items: { id, unit_price?, quantity?, name? }[] }
// Edits existing line items (price / quantity) in place. Every update is scoped
// to the session's own items, so a stray id can't touch another bill's rows.
export async function PATCH(req: Request, { params }: Params) {
  const limited = rateLimitGuard(req, 'items', 30, 60_000)
  if (limited) return limited

  const { id } = await params
  const body = await req.json()
  const incoming: ItemPatch[] = Array.isArray(body.items) ? body.items : []
  const db = createServerClient()

  for (const it of incoming) {
    if (!it?.id) continue
    const update: Record<string, number | string> = {}
    if (it.unit_price != null) update.unit_price = Math.max(0, Number(it.unit_price) || 0)
    if (it.quantity != null) update.quantity = Math.max(1, Math.floor(Number(it.quantity) || 1))
    if (typeof it.name === 'string' && it.name.trim()) update.name = it.name.trim()
    if (Object.keys(update).length === 0) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db.from('items').update(update as any).eq('id', it.id).eq('session_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Keep the session's food subtotal + grand total in step with the edited rows.
  const { data: items } = await db
    .from('items')
    .select('unit_price, quantity')
    .eq('session_id', id)

  if (items) {
    const foodSubtotal =
      Math.round(
        (items as { unit_price: number; quantity: number }[]).reduce(
          (s, i) => s + Number(i.unit_price) * Number(i.quantity),
          0,
        ) * 100,
      ) / 100
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.from('sessions').update({ food_subtotal: foodSubtotal } as any).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
