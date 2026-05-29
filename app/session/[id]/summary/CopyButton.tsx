'use client'

import { useState } from 'react'
import type { PersonTotal } from '@/types'

export default function CopyButton({
  persons,
  grandTotal,
}: {
  persons: PersonTotal[]
  grandTotal: number
}) {
  const [copied, setCopied] = useState(false)

  function copyText() {
    const lines = persons.map(p => `${p.display_name}: ฿${p.total.toFixed(2)}`)
    lines.push(`\nรวม: ฿${grandTotal.toFixed(2)}`)
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copyText}
      className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
    >
      {copied ? 'คัดลอกแล้ว!' : 'คัดลอกสรุป'}
    </button>
  )
}
