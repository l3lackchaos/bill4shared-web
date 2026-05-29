'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function ConfirmActions({
  sessionId,
  billType,
}: {
  sessionId: string
  billType: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    if (billType === 'group_order') {
      // Auto-assign from pre_assigned_person then go to summary
      await fetch(`/api/sessions/${sessionId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_from_preassigned: true }),
      })
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
      router.push(`/session/${sessionId}/summary`)
    } else {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'assigning' }),
      })
      router.push(`/session/${sessionId}/assign`)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={confirm}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {loading ? 'กำลังดำเนินการ...' : billType === 'group_order' ? 'ยืนยัน → ดูสรุป' : 'ยืนยัน → แบ่งรายการ'}
      </button>
      <Link
        href={`/session/${sessionId}/upload`}
        className="block text-center text-sm text-gray-500 hover:text-gray-700"
      >
        อัปโหลดรูปใหม่
      </Link>
    </div>
  )
}
