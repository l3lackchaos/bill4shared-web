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
    <div className="max-w-md mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
        ← กลับ
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">บิลใหม่</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">โหมดแบ่งบิล</label>
          <div className="space-y-2">
            {[
              { mode: 1 as const, label: 'Mode 1 — ตามสัดส่วน', desc: 'ค่าส่ง + ส่วนลด ตาม % อาหาร' },
              { mode: 2 as const, label: 'Mode 2 — ผสม (แนะนำ)', desc: 'ค่าส่ง หารเท่ากัน, ส่วนลด ตาม % อาหาร' },
              { mode: 3 as const, label: 'Mode 3 — เท่ากันหมด', desc: 'ค่าส่ง + ส่วนลด หารหัวเท่ากัน' },
            ].map(({ mode, label, desc }) => (
              <label
                key={mode}
                className={`flex items-start gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  splitMode === mode ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={mode}
                  checked={splitMode === mode}
                  onChange={() => setSplitMode(mode)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={create}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'กำลังสร้าง...' : 'สร้างบิลและอัปโหลดรูป'}
        </button>
      </div>
    </div>
  )
}
