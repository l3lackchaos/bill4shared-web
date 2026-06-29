'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = { name: string; unit_price: string; quantity: string }

const emptyRow = (): Row => ({ name: '', unit_price: '', quantity: '1' })

export default function ManualForm({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [deliveryFee, setDeliveryFee] = useState('')
  const [totalDiscount, setTotalDiscount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const validRows = rows.filter(r => r.name.trim() && Number(r.unit_price) > 0)
  const foodSubtotal = validRows.reduce((s, r) => s + Number(r.unit_price) * (Number(r.quantity) || 1), 0)
  const grandTotal = foodSubtotal + (Number(deliveryFee) || 0) - (Number(totalDiscount) || 0)

  async function submit() {
    if (validRows.length === 0) {
      setError('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ พร้อมราคา')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map(r => ({
            name: r.name.trim(),
            unit_price: Number(r.unit_price),
            quantity: Number(r.quantity) || 1,
          })),
          delivery_fee: Number(deliveryFee) || 0,
          total_discount: Number(totalDiscount) || 0,
        }),
      })
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
      router.push(`/session/${sessionId}/confirm`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="bg-surface rounded-3xl border border-line shadow-[var(--shadow-sm)] divide-y divide-line">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              placeholder="ชื่อรายการ"
              value={row.name}
              onChange={e => updateRow(i, { name: e.target.value })}
              className="flex-1 min-w-0 border border-line rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="ราคา"
              value={row.unit_price}
              onChange={e => updateRow(i, { unit_price: e.target.value })}
              className="w-20 border border-line rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="จำนวน"
              value={row.quantity}
              onChange={e => updateRow(i, { quantity: e.target.value })}
              className="w-14 border border-line rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="ลบรายการนี้"
              disabled={rows.length === 1}
              className="text-ink-faint hover:text-red-600 disabled:opacity-30 transition-colors shrink-0"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 w-full text-sm font-semibold text-brand-strong border-2 border-dashed border-line rounded-xl py-2.5 hover:border-[var(--brand)] hover:bg-brand-tint/50 transition-colors"
      >
        + เพิ่มรายการ
      </button>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-ink mb-1 block">ค่าส่ง (ถ้ามี)</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={deliveryFee}
            onChange={e => setDeliveryFee(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink mb-1 block">ส่วนลดรวม (ถ้ามี)</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={totalDiscount}
            onChange={e => setTotalDiscount(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-between items-center px-4 py-3 bg-brand-tint rounded-2xl">
        <span className="text-sm font-semibold text-brand-ink">ยอดรวมทั้งบิล</span>
        <span className="text-lg font-bold text-brand-strong">฿{grandTotal.toFixed(2)}</span>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[image:var(--brand-grad)] text-white py-3 rounded-full font-semibold shadow-[var(--shadow-md)] hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 clay-press transition-all duration-200"
      >
        {loading ? 'กำลังบันทึก...' : 'บันทึกและไปต่อ'}
      </button>
    </div>
  )
}
