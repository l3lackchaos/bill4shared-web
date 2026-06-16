import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { loadSummary } from '@/lib/summary'
import Avatar from '../../Avatar'

type Props = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

const MODE_LABEL: Record<number, string> = {
  1: 'ตามสัดส่วน',
  2: 'ผสม',
  3: 'เท่ากันหมด',
}

// Read-only, no app chrome to edit — meant to be opened by anyone the link is
// shared with so they can see what they owe.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await loadSummary(id)
  if (!data) return { title: 'ไม่พบบิล' }
  return {
    title: `บิล ฿${data.result.net_payable.toFixed(0)}`,
    description: `แชร์บิล ${data.result.persons.length} คน — เปิดดูว่าใครจ่ายเท่าไหร่`,
    // Private bill — keep it out of search engines even though the link is shareable.
    robots: { index: false, follow: false },
  }
}

export default async function SharePage({ params }: Props) {
  const { id } = await params
  const data = await loadSummary(id)
  if (!data) notFound()

  const { session, result, extraCharges, personItems } = data

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <div className="flex items-center gap-2.5 pt-8 pb-6">
        <span className="grid place-items-center w-9 h-9 rounded-xl text-white shadow-[var(--shadow-md)] bg-[image:var(--brand-grad)]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-3 4h3M5 3h14a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-3-2 1 1V4a1 1 0 011-1z" />
          </svg>
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink leading-tight">สรุปบิล</h1>
          <p className="text-ink-faint text-xs">วิธีแบ่ง: {MODE_LABEL[session.split_mode] ?? ''}</p>
        </div>
      </div>

      <ul className="space-y-3 mb-7 list-none p-0">
        {result.persons.map((p, idx) => {
          const ownItems = personItems.get(p.display_name) ?? []
          return (
            <li
              key={p.display_name}
              className="bg-surface rounded-2xl border border-line shadow-[var(--shadow-sm)] overflow-hidden rise card-lift"
              style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={p.display_name} />
                <p className="font-semibold text-ink flex-1 min-w-0 truncate">{p.display_name}</p>
                <p className="tnum text-2xl font-extrabold text-[var(--brand-strong)] leading-none">
                  ฿{p.total.toFixed(2)}
                </p>
              </div>
              {ownItems.length > 0 && (
                <div className="border-t border-line bg-canvas/60 px-4 py-2.5 space-y-1">
                  {ownItems.map((item, i) => (
                    <div key={`${item.id}-${i}`} className="flex justify-between text-xs text-ink-soft">
                      <span className="flex-1 pr-2 truncate">
                        {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      <span className="tnum shrink-0">฿{item.share.toFixed(2)}</span>
                    </div>
                  ))}
                  {(p.delivery_share > 0 || p.discount_received > 0 || p.thai_help_received > 0) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs pt-1.5 mt-0.5 border-t border-line">
                      {p.delivery_share > 0 && <span className="text-ink-faint">ค่าส่ง +฿{p.delivery_share.toFixed(2)}</span>}
                      {p.discount_received > 0 && <span className="text-[var(--neg)]">ส่วนลด -฿{p.discount_received.toFixed(2)}</span>}
                      {p.thai_help_received > 0 && <span className="text-[var(--warn)]">ไทยช่วยไทย -฿{p.thai_help_received.toFixed(2)}</span>}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {extraCharges.length > 0 && (
        <div className="bg-surface border border-line rounded-2xl px-4 py-3 mb-3 text-sm space-y-1.5 shadow-[var(--shadow-sm)]">
          {extraCharges.map((c, i) => (
            <div key={i} className={`flex justify-between ${c.kind === 'discount' ? 'text-[var(--neg)]' : 'text-ink-soft'}`}>
              <span>{c.label}</span>
              <span className="tnum">{c.kind === 'discount' ? '-' : '+'}฿{Number(c.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {result.thai_help_amount > 0 && (
        <div className="bg-warn-tint border border-[var(--warn)]/25 rounded-2xl px-4 py-3 mb-3 text-sm space-y-1.5">
          <div className="flex justify-between text-ink-soft">
            <span>ยอดบิล</span><span className="tnum">฿{Number(session.grand_total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[var(--warn)] font-medium">
            <span>ไทยช่วยไทย (รัฐช่วยจ่าย)</span><span className="tnum">-฿{result.thai_help_amount.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl px-5 py-4 mb-7 flex justify-between items-center text-white bg-[image:var(--brand-grad)] glow-brand">
        <span className="text-sm font-medium opacity-90">
          {result.thai_help_amount > 0 ? 'กลุ่มจ่ายจริง' : 'รวมทั้งหมด'}
        </span>
        <span className="tnum text-3xl font-extrabold">฿{result.net_payable.toFixed(2)}</span>
      </div>

      <Link
        href="/new"
        className="block text-center bg-surface border border-line text-ink-soft py-2.5 rounded-full text-sm font-medium hover:border-[var(--brand)]/40 hover:text-ink transition-colors"
      >
        แตกบิลของคุณเอง →
      </Link>
    </div>
  )
}
