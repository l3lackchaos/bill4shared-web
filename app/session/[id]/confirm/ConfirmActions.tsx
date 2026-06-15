'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { computeThaiHelp } from '@/lib/bill'
import { THAI_HELP_RATE, THAI_HELP_CAP } from '@/types'

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

  // ไทยช่วยไทย — user enters the remaining subsidy balance for THIS bill
  const [thaiHelp, setThaiHelp] = useState(thaiHelpEnabled)
  const [balance, setBalance] = useState(thaiHelpBalance)

  const computedGrand = Math.round((foodSubtotal + delivery - discount) * 100) / 100
  const grand = grandOverride ?? computedGrand

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
    await patch({
      delivery_fee: delivery,
      total_discount: discount,
      grand_total: grand,
      split_mode: mode,
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

      {/* ไทยช่วยไทย — government co-pay subsidy (user enters remaining balance) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span>
            <span className="block text-sm font-semibold text-amber-900">🇹🇭 ไทยช่วยไทย</span>
            <span className="block text-xs text-amber-700 mt-0.5">
              รัฐช่วยจ่าย {Math.round(THAI_HELP_RATE * 100)}% สูงสุด ฿{THAI_HELP_CAP}/บิล
            </span>
          </span>
          <input
            type="checkbox"
            checked={thaiHelp}
            onChange={e => setThaiHelp(e.target.checked)}
            className="h-5 w-9 shrink-0 appearance-none rounded-full bg-gray-300 checked:bg-amber-500 relative cursor-pointer transition-colors
              before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
          />
        </label>

        {thaiHelp && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-200 space-y-2 text-xs">
            <div className="flex justify-between items-center text-amber-800">
              <span>ยอดสิทธิ์คงเหลือ</span>
              <div className="flex items-center gap-1">
                <span>฿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={balance}
                  onChange={e => setBalance(num(e.target.value))}
                  placeholder="0"
                  className="w-24 text-right border border-amber-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>รัฐช่วยจ่ายบิลนี้</span>
              <span className="font-medium">-฿{subsidy.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-amber-900">
              <span>กลุ่มจ่ายจริง</span>
              <span>฿{netPayable.toFixed(2)}</span>
            </div>
            {balance <= 0 && (
              <p className="text-red-600">กรอกยอดสิทธิ์คงเหลือ — ถ้าเป็น 0 จะไม่ได้รับส่วนช่วย</p>
            )}
          </div>
        )}
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
