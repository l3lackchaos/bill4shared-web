import { createServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { calculateSplit } from '@/lib/bill'
import Link from 'next/link'
import type { BillItem, ItemAssignment, SplitMode } from '@/types'
import CopyButton from './CopyButton'

type Props = { params: Promise<{ id: string }> }

const MODE_LABEL: Record<number, string> = {
  1: 'Mode 1 — ตามสัดส่วน',
  2: 'Mode 2 — ผสม',
  3: 'Mode 3 — เท่ากันหมด',
}

export default async function SummaryPage({ params }: Props) {
  const { id } = await params
  const db = createServerClient()

  const { data: session } = await db.from('sessions').select('*').eq('id', id).single()
  if (!session) notFound()

  const { data: items } = await db
    .from('items')
    .select('*, assignments(*)')
    .eq('session_id', id)

  type RawItem = BillItem & { assignments: ItemAssignment[] }
  const normalised = ((items ?? []) as RawItem[]).map(item => ({
    ...item,
    pre_assigned_name: (item as unknown as { pre_assigned_name: string | null }).pre_assigned_name ?? null,
    assignments: item.assignments ?? [],
  }))

  const result = calculateSplit(
    {
      id: session.id,
      split_mode: session.split_mode as SplitMode,
      food_subtotal: Number(session.food_subtotal),
      delivery_fee: Number(session.delivery_fee),
      total_discount: Number(session.total_discount),
      grand_total: Number(session.grand_total),
      extra_charges: session.extra_charges ?? [],
      thai_help_enabled: Boolean(session.thai_help_enabled),
      thai_help_balance: Number(session.thai_help_balance ?? 0),
    },
    normalised,
  )

  // Build items-per-person lookup for item breakdown in summary cards
  const personItems = new Map<string, { id: string; name: string; unit_price: number; quantity: number; share: number }[]>()
  for (const item of normalised) {
    const itemTotal = item.unit_price * item.quantity
    for (const a of item.assignments) {
      const shareAmt = itemTotal * (a.share_numerator / a.share_denominator)
      const list = personItems.get(a.display_name) ?? []
      list.push({ id: item.id, name: item.name, unit_price: item.unit_price, quantity: item.quantity, share: shareAmt })
      personItems.set(a.display_name, list)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
        ← กลับหน้าแรก
      </Link>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">สรุปบิล</h1>
        {!result.verified && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
            ยอดไม่ตรง
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">{MODE_LABEL[session.split_mode] ?? ''}</p>

      <div className="space-y-3 mb-6">
        {result.persons.map(p => {
          const ownItems = personItems.get(p.display_name) ?? []
          return (
            <div key={p.display_name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3">
                <p className="font-semibold text-gray-900">{p.display_name}</p>
                <p className="text-xl font-bold text-indigo-600">฿{p.total.toFixed(2)}</p>
              </div>
              {ownItems.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-2 space-y-1">
                  {ownItems.map((item, i) => (
                    <div key={`${item.id}-${i}`} className="flex justify-between text-xs text-gray-500">
                      <span className="flex-1 pr-2 truncate">
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      <span className="shrink-0">฿{item.share.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-x-3 justify-between text-xs pt-1 border-t border-gray-100">
                    {p.delivery_share > 0 && (
                      <span className="text-gray-400">ค่าส่ง +฿{p.delivery_share.toFixed(2)}</span>
                    )}
                    {p.discount_received > 0 && (
                      <span className="text-red-400">ส่วนลด -฿{p.discount_received.toFixed(2)}</span>
                    )}
                    {p.thai_help_received > 0 && (
                      <span className="text-amber-600">ไทยช่วยไทย -฿{p.thai_help_received.toFixed(2)}</span>
                    )}
                    {p.delivery_share === 0 && p.discount_received === 0 && p.thai_help_received === 0 && <span />}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {result.thai_help_amount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>ยอดบิล</span>
            <span>฿{Number(session.grand_total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-amber-700">
            <span>🇹🇭 ไทยช่วยไทย (รัฐช่วยจ่าย)</span>
            <span>-฿{result.thai_help_amount.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="bg-gray-900 text-white rounded-xl px-4 py-3 flex justify-between items-center mb-6">
        <span className="text-sm font-medium">
          {result.thai_help_amount > 0 ? 'กลุ่มจ่ายจริง' : 'รวมทั้งหมด'}
        </span>
        <span className="text-lg font-bold">฿{result.net_payable.toFixed(2)}</span>
      </div>

      <CopyButton
        persons={result.persons}
        grandTotal={result.net_payable}
        thaiHelpAmount={result.thai_help_amount}
      />

      <div className="mt-4 flex gap-3">
        <Link
          href={`/session/${id}/assign`}
          className="flex-1 text-center border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          แก้ไขการแบ่ง
        </Link>
        <Link
          href="/new"
          className="flex-1 text-center bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
        >
          บิลใหม่
        </Link>
      </div>
    </div>
  )
}
