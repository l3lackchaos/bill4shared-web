'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BillSession } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  collecting: 'กำลังรับรูป',
  confirming: 'รอยืนยัน',
  assigning: 'แบ่งรายการ',
  done: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

const STATUS_DOT: Record<string, string> = {
  collecting: 'bg-sky-500',
  confirming: 'bg-amber-500',
  assigning: 'bg-orange-500',
  done: 'bg-[var(--brand)]',
  cancelled: 'bg-gray-400',
}

// Filter chips: All + the statuses that actually carry bills.
const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'confirming', label: 'รอยืนยัน' },
  { key: 'assigning', label: 'แบ่งรายการ' },
  { key: 'done', label: 'เสร็จสิ้น' },
]

const PAGE_SIZE = 8

function billLabel(s: BillSession): string {
  const d = new Date(s.created_at)
  return `บิล ${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
}

export default function BillList({ sessions }: { sessions: BillSession[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Locally hide rows already deleted this session so the list updates instantly.
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  async function deleteBill(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRemoved(prev => new Set(prev).add(id))
      setConfirmId(null)
      router.refresh() // re-sync from server in the background
    }
    setDeletingId(null)
  }

  // Filter by status + free-text (date label or amount). Reset to page 1 whenever
  // the filter inputs change so the user never lands on an empty page.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter(s => {
      if (removed.has(s.id)) return false
      if (status !== 'all' && s.status !== status) return false
      if (!q) return true
      const hay = `${billLabel(s)} ${s.grand_total}`.toLowerCase()
      return hay.includes(q)
    })
  }, [sessions, query, status, removed])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function resetPageThen<T>(fn: (v: T) => void) {
    return (v: T) => { fn(v); setPage(1) }
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => resetPageThen(setQuery)(e.target.value)}
          placeholder="ค้นหาบิล (วันที่ หรือ ยอดเงิน)"
          aria-label="ค้นหาบิล"
          className="w-full bg-surface border border-line rounded-full pl-9 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 focus:border-[var(--brand)]/40 transition-all"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(f => {
          const active = status === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => resetPageThen(setStatus)(f.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-surface border border-line text-ink-soft hover:text-ink hover:border-[var(--brand)]/30'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-ink-faint py-12">ไม่พบบิลที่ตรงกับการค้นหา</p>
      ) : (
        <>
          <ul className="space-y-2.5 list-none p-0">
            {pageItems.map((s, i) => (
              <li key={s.id} className="rise relative group" style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}>
                {confirmId === s.id ? (
                  <div className="flex items-center justify-between bg-surface rounded-2xl border border-[var(--neg)]/40 px-4 py-3.5 shadow-[var(--shadow-sm)]">
                    <span className="text-sm text-ink">ลบบิลนี้?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => deleteBill(s.id)}
                        disabled={deletingId === s.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--neg)] text-white disabled:opacity-50 active:scale-95 transition-all"
                      >
                        {deletingId === s.id ? 'กำลังลบ...' : 'ลบ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-ink-soft hover:text-ink"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link
                      href={`/session/${s.id}`}
                      className="flex items-center justify-between bg-surface rounded-2xl border border-line pl-4 pr-12 py-3.5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--brand)]/30 card-lift"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-sm">{billLabel(s)}</p>
                        <p className="flex items-center gap-1.5 text-xs text-ink-faint mt-0.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] ?? 'bg-gray-400'}`} aria-hidden="true" />
                          {STATUS_LABEL[s.status] ?? s.status}
                          <span className="text-line">·</span>
                          {new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="tnum text-lg font-bold text-ink shrink-0">
                        {s.grand_total > 0 ? `฿${s.grand_total.toFixed(0)}` : '—'}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmId(s.id)}
                      aria-label={`ลบ ${billLabel(s)}`}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-ink-faint hover:text-[var(--neg)] hover:bg-[var(--neg)]/10 opacity-40 group-hover:opacity-100 focus:opacity-100 transition-all"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-1.99-1.86L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* Pagination — only when there's more than one page */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1 text-sm text-ink-soft disabled:opacity-30 disabled:pointer-events-none hover:text-ink transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                ก่อนหน้า
              </button>
              <span className="text-xs text-ink-faint tnum">{safePage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1 text-sm text-ink-soft disabled:opacity-30 disabled:pointer-events-none hover:text-ink transition-colors"
              >
                ถัดไป
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
