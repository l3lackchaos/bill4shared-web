import { notFound } from 'next/navigation'
import { loadSummary } from '@/lib/summary'
import Link from 'next/link'
import CopyButton from './CopyButton'
import SummaryCharges from './SummaryCharges'
import ShareButton from './ShareButton'

type Props = { params: Promise<{ id: string }> }

const MODE_LABEL: Record<number, string> = {
  1: 'Mode 1 — ตามสัดส่วน',
  2: 'Mode 2 — ผสม',
  3: 'Mode 3 — เท่ากันหมด',
}

export default async function SummaryPage({ params }: Props) {
  const { id } = await params
  const data = await loadSummary(id)
  if (!data) notFound()

  const { session, result, extraCharges, personItems } = data

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink pt-8 mb-5 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        หน้าแรก
      </Link>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-ink">สรุปบิล</h1>
        {!result.verified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-warn-tint text-[var(--warn)] px-2.5 py-1 rounded-full">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z" />
            </svg>
            ยอดไม่ตรง
          </span>
        )}
      </div>
      <p className="text-sm text-ink-faint mb-7">{MODE_LABEL[session.split_mode] ?? ''}</p>

      <ul className="space-y-3 mb-7 list-none p-0">
        {result.persons.map((p, idx) => {
          const ownItems = personItems.get(p.display_name) ?? []
          return (
            <li
              key={p.display_name}
              className="bg-surface rounded-2xl border border-line shadow-[var(--shadow-sm)] overflow-hidden rise card-lift"
              style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}
            >
              <div className="flex justify-between items-center px-4 py-3.5">
                <p className="font-semibold text-ink">{p.display_name}</p>
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
                      {p.delivery_share > 0 && (
                        <span className="text-ink-faint">ค่าส่ง +฿{p.delivery_share.toFixed(2)}</span>
                      )}
                      {p.discount_received > 0 && (
                        <span className="text-[var(--neg)]">ส่วนลด -฿{p.discount_received.toFixed(2)}</span>
                      )}
                      {p.thai_help_received > 0 && (
                        <span className="text-[var(--warn)]">ไทยช่วยไทย -฿{p.thai_help_received.toFixed(2)}</span>
                      )}
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
            <span>ยอดบิล</span>
            <span className="tnum">฿{Number(session.grand_total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[var(--warn)] font-medium">
            <span>ไทยช่วยไทย (รัฐช่วยจ่าย)</span>
            <span className="tnum">-฿{result.thai_help_amount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Grand total — the hero figure of the page */}
      <div className="rounded-2xl px-5 py-4 mb-7 flex justify-between items-center text-white bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] glow-brand">
        <span className="text-sm font-medium opacity-90">
          {result.thai_help_amount > 0 ? 'กลุ่มจ่ายจริง' : 'รวมทั้งหมด'}
        </span>
        <span className="tnum text-3xl font-extrabold">฿{result.net_payable.toFixed(2)}</span>
      </div>

      <div className="space-y-2.5">
        <ShareButton sessionId={id} />
        <CopyButton
          persons={result.persons}
          grandTotal={result.net_payable}
          thaiHelpAmount={result.thai_help_amount}
        />
      </div>

      <div className="mt-4">
        <SummaryCharges
          sessionId={id}
          foodSubtotal={Number(session.food_subtotal)}
          deliveryFee={Number(session.delivery_fee)}
          totalDiscount={Number(session.total_discount)}
          splitMode={Number(session.split_mode)}
          initialCharges={extraCharges}
        />
      </div>

      <div className="mt-4 flex gap-3">
        <Link
          href={`/session/${id}/assign`}
          className="flex-1 text-center border border-line text-ink-soft py-2.5 rounded-full text-sm font-medium bg-surface hover:border-[var(--brand)]/40 hover:text-ink transition-colors"
        >
          แก้ไขการแบ่ง
        </Link>
        <Link
          href="/new"
          className="flex-1 text-center bg-[var(--brand)] text-white py-2.5 rounded-full text-sm font-semibold shadow-[var(--shadow-md)] hover:bg-[var(--brand-strong)] active:scale-95 transition-all duration-200"
        >
          บิลใหม่
        </Link>
      </div>
    </div>
  )
}
