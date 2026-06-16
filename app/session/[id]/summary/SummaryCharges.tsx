'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ExtraCharge } from '@/types'

const round2 = (n: number) => Math.round(n * 100) / 100

const MODE_OPTIONS = [
  { mode: 1, label: 'Mode 1 — ตามสัดส่วน (ค่าส่ง+ส่วนลด ตาม %อาหาร)' },
  { mode: 2, label: 'Mode 2 — ผสม (ค่าส่งหารเท่ากัน, ส่วนลดตาม %อาหาร)' },
  { mode: 3, label: 'Mode 3 — เท่ากันหมด (หารหัวเท่ากัน)' },
]

// Edit custom fees/discounts and the split mode straight from the summary, then
// recompute & save. grand_total is rederived from the fixed parts (food +
// delivery − discount) plus the current extras, matching the confirm step.
export default function SummaryCharges({
  sessionId,
  foodSubtotal,
  deliveryFee,
  totalDiscount,
  splitMode,
  initialCharges,
}: {
  sessionId: string
  foodSubtotal: number
  deliveryFee: number
  totalDiscount: number
  splitMode: number
  initialCharges: ExtraCharge[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [charges, setCharges] = useState<ExtraCharge[]>(initialCharges)
  const [mode, setMode] = useState(splitMode || 2)
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
      body: JSON.stringify({ extra_charges: clean, grand_total: newGrand, split_mode: mode }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh() // re-run the server component so totals recompute
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-line text-ink-soft py-2 rounded-lg text-sm hover:bg-canvas transition-colors"
      >
        แก้ไขโหมด / ค่าบริการ / ส่วนลด
      </button>
    )
  }

  return (
    <div className="bg-canvas rounded-xl border border-line px-4 py-3 space-y-2 text-sm">
      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1.5">โหมดแบ่งบิล</label>
        <select
          value={mode}
          onChange={e => setMode(Number(e.target.value))}
          className="w-full border border-line rounded-lg px-3 py-2 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          {MODE_OPTIONS.map(o => (
            <option key={o.mode} value={o.mode}>{o.label}</option>
          ))}
        </select>
      </div>

      <p className="font-medium text-ink-soft pt-1">ค่าบริการ / ส่วนลดเพิ่มเติม</p>

      {charges.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={c.label}
            placeholder={c.kind === 'fee' ? 'ชื่อค่าบริการ' : 'ชื่อส่วนลด'}
            onChange={e => updateCharge(i, { label: e.target.value })}
            className="flex-1 min-w-0 border border-line rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
          <div className={`flex items-center gap-1 ${c.kind === 'discount' ? 'text-red-600' : 'text-ink-soft'}`}>
            <span>{c.kind === 'discount' ? '-฿' : '฿'}</span>
            <input
              type="number"
              inputMode="decimal"
              value={c.amount || ''}
              placeholder="0"
              onChange={e => updateCharge(i, { amount: num(e.target.value) })}
              className="w-16 text-right border border-line rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
          </div>
          <button onClick={() => removeCharge(i)} className="text-ink-faint hover:text-red-500 text-sm px-0.5">
            ×
          </button>
        </div>
      ))}

      <div className="flex gap-3 pt-0.5">
        <button onClick={() => addCharge('fee')} className="text-[var(--brand-strong)] hover:text-[var(--brand)] text-xs font-medium">
          + ค่าบริการ
        </button>
        <button onClick={() => addCharge('discount')} className="text-red-500 hover:text-red-600 text-xs font-medium">
          + ส่วนลด
        </button>
      </div>

      <div className="flex justify-between font-semibold text-ink pt-2 border-t border-line">
        <span>ยอดรวมใหม่</span>
        <span>฿{newGrand.toFixed(2)}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-[var(--brand)] text-white py-2.5 rounded-full text-sm font-semibold hover:bg-[var(--brand-strong)] active:scale-[0.98] disabled:opacity-40 transition-all duration-200"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก & คำนวณใหม่'}
        </button>
        <button
          onClick={() => { setCharges(initialCharges); setMode(splitMode || 2); setOpen(false) }}
          className="px-3 text-sm text-ink-soft hover:text-ink-soft"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  )
}
