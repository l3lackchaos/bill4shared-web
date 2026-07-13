import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'
import ConfirmClient from './ConfirmClient'
import type { ExtraCharge } from '@/types'

type Props = { params: Promise<{ id: string }> }

type ItemRow = { id: string; name: string; unit_price: number; quantity: number; pre_assigned_name: string | null }

export default async function ConfirmPage({ params }: Props) {
  const { id } = await params
  const db = createServerClient()

  const [{ data: session }, { data: items }] = await Promise.all([
    db.from('sessions').select('*').eq('id', id).single(),
    db.from('items').select('*').eq('session_id', id).order('id'),
  ])
  if (!session) notFound()
  if (!items) notFound()

  if (session.status === 'done') redirect(`/session/${id}/summary`)

  const typedItems = (items as ItemRow[]).map(i => ({
    id: i.id,
    name: i.name,
    unit_price: Number(i.unit_price),
    quantity: Number(i.quantity),
    pre_assigned_name: i.pre_assigned_name,
  }))

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink pt-8 mb-5 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        หน้าแรก
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">ยืนยันรายการ</h1>
      <p className="text-sm text-ink-faint mb-6">ตรวจสอบและแก้ไขราคาแต่ละรายการก่อนไปขั้นตอนถัดไป</p>

      <ConfirmClient
        session={{
          id,
          bill_type: session.bill_type,
          food_subtotal: Number(session.food_subtotal),
          delivery_fee: Number(session.delivery_fee),
          total_discount: Number(session.total_discount),
          food_discount: Number(session.food_discount ?? 0),
          grand_total: Number(session.grand_total),
          split_mode: Number(session.split_mode),
          thai_help_enabled: Boolean(session.thai_help_enabled),
          thai_help_balance: Number(session.thai_help_balance ?? 0),
          extra_charges: (session.extra_charges ?? []) as ExtraCharge[],
        }}
        items={typedItems}
      />
    </div>
  )
}
