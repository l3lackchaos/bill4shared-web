'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { computeThaiHelp } from '@/lib/bill'
import { THAI_HELP_RATE, THAI_HELP_CAP } from '@/types'
import type { ExtraCharge } from '@/types'

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
  thaiHelpEnabled,
  thaiHelpBalance,
  extraCharges,
}: {
  sessionId: string
  billType: string
  foodSubtotal: number
  deliveryFee: number
  totalDiscount: number
  grandTotal: number
  splitMode: number
  thaiHelpEnabled: boolean
  thaiHelpBalance: number
  extraCharges: ExtraCharge[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [delivery, setDelivery] = useState(deliveryFee)
  const [discount, setDiscount] = useState(totalDiscount)
  const [mode, setMode] = useState(splitMode || 2)
  // Custom extra charges (service charge, VAT, ค่าภาชนะ, extra discount, …)
  const [charges, setCharges] = useState<ExtraCharge[]>(extraCharges)

  // Net effect of extra charges on the bill total: fees add, discounts subtract.
  const extraFees = charges.filter(c => c.kind === 'fee').reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const extraDiscounts = charges.filter(c => c.kind === 'discount').reduce((s, c) => s + (Number(c.amount) || 0), 0)

  // null → keep grand_total in sync with food + delivery − discount + extras; a number → user override
  const [grandOverride, setGrandOverride] = useState<number | null>(
    Math.abs(grandTotal - (foodSubtotal + deliveryFee - totalDiscount)) > 0.01 ? grandTotal : null,
  )

  // ไทยช่วยไทย — user enters the remaining subsidy balance for THIS bill
  const [thaiHelp, setThaiHelp] = useState(thaiHelpEnabled)
  const [balance, setBalance] = useState(thaiHelpBalance)

  const computedGrand = Math.round((foodSubtotal + delivery - discount + extraFees - extraDiscounts) * 100) / 100
  const grand = grandOverride ?? computedGrand

  function addCharge(kind: ExtraCharge['kind']) {
    setCharges(prev => [...prev, { label: '', amount: 0, kind }])
    setGrandOverride(null) // re-sync total when charges change
  }
  function updateCharge(i: number, patch: Partial<ExtraCharge>) {
    setCharges(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
    setGrandOverride(null)
  }
  function removeCharge(i: number) {
    setCharges(prev => prev.filter((_, idx) => idx !== i))
    setGrandOverride(null)
  }

  // ไทยช่วยไทย base = (food − discount), excluding delivery. Subsidy =
  // min(60% × base, ฿200 cap, balance entered). Keep this identical to
  // calculateSplit() so the preview matches the summary exactly.
  const thaiHelpBase = Math.max(0, Math.round((foodSubtotal - discount) * 100) / 100)
  const subsidy = thaiHelp ? computeThaiHelp(thaiHelpBase, balance) : 0
  const netPayable = Math.round((grand - subsidy) * 100) / 100

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
    // Persist edits to fees / discount / mode + ไทยช่วยไทย before calculating.
    // thai_help_amount is the applied subsidy; store it so the summary matches.
    // Drop blank rows (no label and no amount) before saving.
    const cleanCharges = charges
      .filter(c => c.label.trim() !== '' || Number(c.amount) > 0)
      .map(c => ({ label: c.label.trim() || (c.kind === 'fee' ? 'ค่าบริการ' : 'ส่วนลด'), amount: Math.abs(Number(c.amount) || 0), kind: c.kind }))

    await patch({
      delivery_fee: delivery,
      total_discount: discount,
      grand_total: grand,
      split_mode: mode,
      extra_charges: cleanCharges,
      thai_help_enabled: thaiHelp,
      thai_help_balance: balance,
      thai_help_amount: subsidy,
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
      <div className="bg-canvas rounded-xl border border-line px-4 py-3 space-y-2 text-sm">
        {foodSubtotal > 0 && (
          <div className="flex justify-between text-ink-soft">
            <span>ค่าอาหาร</span>
            <span>฿{foodSubtotal.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-ink-soft">
          <span>ค่าจัดส่ง</span>
          <div className="flex items-center gap-1">
            <span>฿</span>
            <input
              type="number"
              inputMode="decimal"
              value={delivery}
              onChange={e => setDelivery(num(e.target.value))}
              className="w-20 text-right border border-line rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
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
              className="w-20 text-right border border-line rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
          </div>
        </div>

        {/* Custom extra charges / discounts */}
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
            <button
              type="button"
              onClick={() => removeCharge(i)}
              aria-label={`ลบ ${c.label || (c.kind === 'fee' ? 'ค่าบริการ' : 'ส่วนลด')}`}
              className="text-ink-faint hover:text-red-500 w-7 h-7 flex items-center justify-center shrink-0 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <div className="flex gap-3 pt-0.5">
          <button
            type="button"
            onClick={() => addCharge('fee')}
            className="text-[var(--brand-strong)] hover:text-[var(--brand)] text-xs font-medium"
          >
            + ค่าบริการ
          </button>
          <button
            type="button"
            onClick={() => addCharge('discount')}
            className="text-red-500 hover:text-red-600 text-xs font-medium"
          >
            + ส่วนลด
          </button>
        </div>

        <div className="flex justify-between items-center font-semibold text-ink pt-2 border-t border-line">
          <span>รวมทั้งหมด</span>
          <div className="flex items-center gap-1">
            <span>฿</span>
            <input
              type="number"
              inputMode="decimal"
              value={grand}
              onChange={e => setGrandOverride(num(e.target.value))}
              className="w-24 text-right border border-line rounded px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1.5">โหมดแบ่งบิล</label>
        <select
          value={mode}
          onChange={e => setMode(Number(e.target.value))}
          className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          {MODE_OPTIONS.map(o => (
            <option key={o.mode} value={o.mode}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ไทยช่วยไทย — government co-pay subsidy (user enters remaining balance).
          Uses warn tokens so the box adapts to light/dark instead of a fixed
          cream that glares in dark mode. */}
      <div className="rounded-xl border border-[var(--warn)]/25 bg-warn-tint px-4 py-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span>
            <span className="block text-sm font-semibold text-ink">ไทยช่วยไทย</span>
            <span className="block text-xs text-ink-soft mt-0.5">
              รัฐช่วยจ่าย {Math.round(THAI_HELP_RATE * 100)}% สูงสุด ฿{THAI_HELP_CAP}/บิล
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={thaiHelp}
            aria-label="เปิดใช้ไทยช่วยไทย"
            onChange={e => setThaiHelp(e.target.checked)}
            className="h-6 w-11 shrink-0 appearance-none rounded-full bg-line checked:bg-[var(--warn)] relative cursor-pointer transition-colors
              before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-surface before:shadow before:transition-transform checked:before:translate-x-5"
          />
        </label>

        {thaiHelp && (
          <div className="mt-2.5 pt-2.5 border-t border-[var(--warn)]/25 space-y-2 text-xs">
            <div className="flex justify-between items-center text-ink-soft">
              <span>ยอดสิทธิ์คงเหลือ</span>
              <div className="flex items-center gap-1">
                <span>฿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={balance}
                  onChange={e => setBalance(num(e.target.value))}
                  placeholder="0"
                  className="w-24 text-right border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-[var(--warn)]"
                />
              </div>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>รัฐช่วยจ่ายบิลนี้</span>
              <span className="tnum font-medium text-[var(--warn)]">-฿{subsidy.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-ink">
              <span>กลุ่มจ่ายจริง</span>
              <span className="tnum">฿{netPayable.toFixed(2)}</span>
            </div>
            {balance <= 0 && (
              <p className="text-[var(--neg)]">กรอกยอดสิทธิ์คงเหลือ — ถ้าเป็น 0 จะไม่ได้รับส่วนช่วย</p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={confirm}
        disabled={loading}
        className="w-full bg-[var(--brand)] text-white py-2.5 rounded-lg font-medium hover:bg-[var(--brand-strong)] disabled:opacity-40 transition-colors"
      >
        {loading ? 'กำลังดำเนินการ...' : billType === 'group_order' ? 'ยืนยัน → ดูสรุป' : 'ยืนยัน → แบ่งรายการ'}
      </button>
      <Link
        href={`/session/${sessionId}/upload`}
        className="block text-center text-sm text-ink-soft hover:text-ink-soft"
      >
        อัปโหลดรูปใหม่
      </Link>
    </div>
  )
}
