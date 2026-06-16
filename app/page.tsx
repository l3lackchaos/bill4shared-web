import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import type { BillSession } from '@/types'

// Render per-request: this page lists live sessions from Supabase, so it must
// not be prerendered at build time (env vars aren't present then → build fails).
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  collecting: 'กำลังรับรูป',
  confirming: 'รอยืนยัน',
  assigning: 'แบ่งรายการ',
  done: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

// Status dots — color carries meaning but is paired with a text label (not
// color-only), so it stays accessible.
const STATUS_DOT: Record<string, string> = {
  collecting: 'bg-sky-500',
  confirming: 'bg-amber-500',
  assigning: 'bg-orange-500',
  done: 'bg-[var(--brand)]',
  cancelled: 'bg-gray-400',
}

async function getSessions(): Promise<BillSession[]> {
  const db = createServerClient()
  const { data } = await db
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
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
        <ul className="space-y-2.5 list-none p-0">
          {sessions.map((s, i) => (
            <li key={s.id} className="rise" style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}>
              <Link
                href={`/session/${s.id}`}
                className="group flex items-center justify-between bg-surface rounded-2xl border border-line px-4 py-3.5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--brand)]/30 card-lift"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm">
                    บิล {new Date(s.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-faint mt-0.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] ?? 'bg-gray-400'}`} aria-hidden="true" />
                    {STATUS_LABEL[s.status] ?? s.status}
                    <span className="text-line">·</span>
                    {new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="tnum text-lg font-bold text-ink">
                    {s.grand_total > 0 ? `฿${s.grand_total.toFixed(0)}` : '—'}
                  </span>
                  <svg className="w-4 h-4 text-ink-faint group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
