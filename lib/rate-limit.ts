import { NextResponse } from 'next/server'

// Lightweight in-memory rate limiter keyed by client IP. Good enough to blunt
// casual abuse / accidental spam on a single instance (create-bill, OCR). Not a
// distributed limiter — on multiple instances each holds its own window, which
// is acceptable for this app's scale. Resets on cold start.
const hits = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  ok: boolean
  retryAfter: number // seconds until the window resets
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  entry.count += 1
  if (entry.count > limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }

  // Note: Map grows unbounded across distinct keys; for this app's traffic that's
  // fine, and a cold start clears it. Add periodic eviction if traffic grows.
}

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Returns a 429 response if over the limit, otherwise null (proceed).
export function rateLimitGuard(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const { ok, retryAfter } = rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs)
  if (ok) return null
  return NextResponse.json(
    { error: 'มีคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
