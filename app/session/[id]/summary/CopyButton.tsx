'use client'

import { useState } from 'react'
import type { PersonTotal } from '@/types'

export default function CopyButton({
  persons,
  grandTotal,
  thaiHelpAmount = 0,
}: {
  persons: PersonTotal[]
  grandTotal: number
  thaiHelpAmount?: number
}) {
  const [copied, setCopied] = useState(false)

  function copyText() {
    const lines = persons.map(p => `${p.display_name}: ฿${p.total.toFixed(2)}`)
    if (thaiHelpAmount > 0) {
      lines.push(`\n🇹🇭 ไทยช่วยไทย: -฿${thaiHelpAmount.toFixed(2)}`)
      lines.push(`กลุ่มจ่ายจริง: ฿${grandTotal.toFixed(2)}`)
    } else {
      lines.push(`\nรวม: ฿${grandTotal.toFixed(2)}`)
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copyText}
      className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
        copied
          ? 'bg-brand-tint text-brand-ink'
          : 'bg-surface border border-line text-ink-soft hover:border-[var(--brand)]/40 hover:text-ink'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-[var(--brand)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          คัดลอกแล้ว!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          คัดลอกสรุป
        </>
      )}
    </button>
  )
}
