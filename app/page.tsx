import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import type { BillSession } from '@/types'
import BillList from './BillList'

// Render per-request: this page lists live sessions from Supabase, so it must
// not be prerendered at build time (env vars aren't present then → build fails).
export const dynamic = 'force-dynamic'

async function getSessions(): Promise<BillSession[]> {
  const db = createServerClient()
  const { data } = await db
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as BillSession[]
}

export default async function HomePage() {
  const sessions = await getSessions()

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      {/* Branded header */}
      <header className="flex items-center justify-between pt-8 pb-7">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-[var(--brand)] text-white shadow-[var(--shadow-sm)]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-3 4h3M5 3h14a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-3-2 1 1V4a1 1 0 011-1z" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-bold text-ink leading-tight">Bill4Shared</h1>
            <p className="text-ink-faint text-xs">แตกบิลง่ายๆ จากรูปใบเสร็จ</p>
          </div>
        </div>
        <Link
          href="/new"
          className="inline-flex items-center gap-1.5 bg-[var(--brand)] text-white pl-3 pr-4 py-2 rounded-full text-sm font-semibold shadow-[var(--shadow-md)] hover:bg-[var(--brand-strong)] active:scale-95 transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          บิลใหม่
        </Link>
      </header>

      {sessions.length === 0 ? (
        <div className="text-center py-20 px-6 rise">
          <span className="grid place-items-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-tint">
            <svg className="w-8 h-8 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-3 4h3M5 3h14a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 011-1z" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-ink mb-1">ยังไม่มีบิล</h2>
          <p className="text-sm text-ink-soft mb-6">ถ่ายรูปใบเสร็จ แล้วให้เราแบ่งหารให้</p>
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 bg-[var(--brand)] text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-[var(--shadow-md)] hover:bg-[var(--brand-strong)] active:scale-95 transition-all duration-200"
          >
            สร้างบิลแรก
          </Link>
        </div>
      ) : (
        <BillList sessions={sessions} />
      )}
    </div>
  )
}
