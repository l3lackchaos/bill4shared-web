import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { rateLimitGuard } from '@/lib/rate-limit'

export async function GET() {
  const db = createServerClient()
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  // Cap new-bill creation: 20 per minute per IP.
  const limited = rateLimitGuard(req, 'create', 20, 60_000)
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const db = createServerClient()

  const { data, error } = await db
    .from('sessions')
    .insert({ split_mode: body.split_mode ?? 2, status: 'collecting' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
