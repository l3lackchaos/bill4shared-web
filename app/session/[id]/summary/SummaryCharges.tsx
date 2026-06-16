'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ExtraCharge } from '@/types'

const round2 = (n: number) => Math.round(n * 100) / 100

// Edit custom fees/discounts straight from the summary, then recompute & save.
// grand_total is rederived from the fixed parts (food + delivery − discount)
// plus the current extras, matching how the confirm step computes it.
export default function SummaryCharges({
  sessionId,
  foodSubtotal,
  deliveryFee,
  totalDiscount,
  initialCharges,
}: {
  sessionId: string
  foodSubtotal: number
  deliveryFee: number
  totalDiscount: number
  initialCharges: ExtraCharge[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [charges, setCharges] = useState<ExtraCharge[]>(initialCharges)
  const [saving, setSaving] = useState(false)

  const num = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  const extraFees = charges.filter(c => c.kind === 'fee').reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const extraDiscounts = charges.filter(c => c.kind === 'discount').reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const newGrand = round2(foodSubtotal + deliveryFee - totalDiscount + extraFees - extraDiscounts)

  function addCharge(kind: ExtraCharge['kind']) {
    setCharges(prev => [...prev, { label: '', amount: 0, kind }])
  }
  function updateCharge(i: number, patch: Partial<ExtraCharge>) {
    setCharges(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }
  function removeCharge(i: number) {
    setCharges(prev => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    setSaving(true)
    const clean = charges
      .filter(c => c.label.trim() !== '' || Number(c.amount) > 0)
      .map(c => ({
        label: c.label.trim() || (c.kind === 'fee' ? 'ค่าบริการ' : 'ส่วนลด'),
        amount: Math.abs(Number(c.amount) || 0),
        kind: c.kind,
      }))

    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_charges: clean, grand_total: newGrand }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh() // re-run the server component so totals recompute
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
      >
        แก้ไขค่าบริการ / ส่วนลด
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-2 text-sm">
      <p className="font-medium text-gray-700">ค่าบริการ / ส่วนลดเพิ่มเติม</p>

      {charges.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={c.label}
            placeholder={c.kind === 'fee' ? 'ชื่อค่าบริการ' : 'ชื่อส่วนลด'}
            onChange={e => updateCharge(i, { label: e.target.value })}
            className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <div className={`flex items-center gap-1 ${c.kind === 'discount' ? 'text-red-600' : 'text-gray-600'}`}>
            <span>{c.kind === 'discount' ? '-฿' : '฿'}</span>
            <input
              type="number"
              inputMode="decimal"
              value={c.amount || ''}
              placeholder="0"
              onChange={e => updateCharge(i, { amount: num(e.target.value) })}
              className="w-16 text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button onClick={() => removeCharge(i)} className="text-gray-300 hover:text-red-500 text-sm px-0.5">
            ×
          </button>
        </div>
      ))}

      <div className="flex gap-3 pt-0.5">
        <button onClick={() => addCharge('fee')} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium">
          + ค่าบริการ
        </button>
        <button onClick={() => addCharge('discount')} className="text-red-500 hover:text-red-600 text-xs font-medium">
          + ส่วนลด
        </button>
      </div>

      <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
        <span>ยอดรวมใหม่</span>
        <span>฿{newGrand.toFixed(2)}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก & คำนวณใหม่'}
        </button>
        <button
          onClick={() => { setCharges(initialCharges); setOpen(false) }}
          className="px-3 text-sm text-gray-500 hover:text-gray-700"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  )
}
