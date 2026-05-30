'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

const MODE_OPTIONS = [
  { mode: 1, label: 'Mode 1 — ตามสัดส่วน (ค่าส่ง+ส่วนลด ตาม %อาหาร)' },
  { mode: 2, label: 'Mode 2 — ผสม (ค่าส่งหารเท่ากัน, ส่วนลดตาม %อาหาร)' },
  { mode: 3, label: 'Mode 3 — เท่ากันหมด (หารหัวเท่ากัน)' },
]

export default function ConfirmActions({
  sessionId,
  billType,
  foodSubtotal,
  deliveryFee,
  totalDiscount,
  grandTotal,
  splitMode,
}: {
  sessionId: string
  billType: string
  foodSubtotal: number
  deliveryFee: number
  totalDiscount: number
  grandTotal: number
  splitMode: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [delivery, setDelivery] = useState(deliveryFee)
  const [discount, setDiscount] = useState(totalDiscount)
  const [mode, setMode] = useState(splitMode || 2)
  // null → keep grand_total in sync with food + delivery − discount; a number → user override
  const [grandOverride, setGrandOverride] = useState<number | null>(
    Math.abs(grandTotal - (foodSubtotal + deliveryFee - totalDiscount)) > 0.01 ? grandTotal : null,
  )

  const computedGrand = Math.round((foodSubtotal + delivery - discount) * 100) / 100
  const grand = grandOverride ?? computedGrand

  const num = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function confirm() {
    setLoading(true)
    // Persist any edits to fees / discount / mode before calculating
    await patch({
      delivery_fee: delivery,
      total_discount: discount,
      grand_total: grand,
      split_mode: mode,
    })

    if (billType === 'group_order') {
      // Auto-assign from pre_assigned_name, then go straight to summary
      await fetch(`/api/sessions/${sessionId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_from_preassigned: true }),
      })
      await patch({ status: 'done' })
      router.push(`/session/${sessionId}/summary`)
    } else {
      await patch({ status: 'assigning' })
      router.push(`/session/${sessionId}/assign`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-2 text-sm">
        {foodSubtotal > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>ค่าอาหาร</span>
            <span>฿{foodSubtotal.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-gray-600">
          <span>ค่าจัดส่ง</span>
          <div className="flex items-center gap-1">
            <span>฿</span>
            <input
              type="number"
              inputMode="decimal"
              value={delivery}
              onChange={e => setDelivery(num(e.target.value))}
              className="w-20 text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-red-600">
          <span>ส่วนลด</span>
          <div className="flex items-center gap-1">
            <span>-฿</span>
            <input
              type="number"
              inputMode="decimal"
              value={discount}
              onChange={e => {
                setDiscount(num(e.target.value))
                setGrandOverride(null) // re-sync grand total when discount changes
              }}
              className="w-20 text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex justify-between items-center font-semibold text-gray-900 pt-2 border-t border-gray-200">
          <span>รวมทั้งหมด</span>
          <div className="flex items-center gap-1">
            <span>฿</span>
            <input
              type="number"
              inputMode="decimal"
              value={grand}
              onChange={e => setGrandOverride(num(e.target.value))}
              className="w-24 text-right border border-gray-200 rounded px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">โหมดแบ่งบิล</label>
        <select
          value={mode}
          onChange={e => setMode(Number(e.target.value))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {MODE_OPTIONS.map(o => (
            <option key={o.mode} value={o.mode}>{o.label}</option>
          ))}
        </select>
      </div>

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
