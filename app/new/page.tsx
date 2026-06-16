'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewSessionPage() {
  const router = useRouter()
  const [splitMode, setSplitMode] = useState<1 | 2 | 3>(2)
  const [loading, setLoading] = useState(false)

  async function create() {
    setLoading(true)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ split_mode: splitMode }),
    })
    const data = await res.json()
    router.push(`/session/${data.id}/upload`)
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink pt-8 mb-5 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        หน้าแรก
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">บิลใหม่</h1>
      <p className="text-sm text-ink-faint mb-7">เลือกวิธีแบ่งค่าส่งและส่วนลด</p>

      <fieldset className="space-y-2.5 border-0 p-0 m-0">
        <legend className="text-sm font-semibold text-ink mb-2">โหมดแบ่งบิล</legend>
        {[
          { mode: 1 as const, label: 'ตามสัดส่วน', desc: 'ค่าส่ง + ส่วนลด ตาม % อาหาร' },
          { mode: 2 as const, label: 'ผสม', desc: 'ค่าส่งหารเท่ากัน, ส่วนลดตาม % อาหาร', rec: true },
          { mode: 3 as const, label: 'เท่ากันหมด', desc: 'ค่าส่ง + ส่วนลด หารหัวเท่ากัน' },
        ].map(({ mode, label, desc, rec }) => {
          const active = splitMode === mode
          return (
            <label
              key={mode}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-all duration-200 ${
                active
                  ? 'bg-brand-tint border-2 border-[var(--brand)] shadow-[var(--shadow-sm)]'
                  : 'bg-surface border-2 border-line hover:border-[var(--brand)]/30'
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={mode}
                checked={active}
                onChange={() => setSplitMode(mode)}
                className="sr-only"
              />
              <span className={`grid place-items-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${active ? 'border-[var(--brand)]' : 'border-line'}`}>
                {active && <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />}
              </span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${active ? 'text-brand-ink' : 'text-ink'}`}>{label}</span>
                  {rec && <span className="text-[11px] font-semibold bg-[var(--brand)] text-white px-2 py-0.5 rounded-full">แนะนำ</span>}
                </span>
                <span className="block text-xs text-ink-faint mt-0.5">{desc}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <button
        type="button"
        onClick={create}
        disabled={loading}
        className="mt-7 w-full inline-flex items-center justify-center gap-2 bg-[image:var(--brand-grad)] text-white py-3 rounded-full font-semibold shadow-[var(--shadow-md)] hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-200"
      >
        {loading ? 'กำลังสร้าง...' : 'สร้างบิลและอัปโหลดรูป'}
      </button>
    </div>
  )
}
