import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'
import { reconcileItems } from '@/lib/bill'
import ConfirmActions from './ConfirmActions'

type Props = { params: Promise<{ id: string }> }

type ItemRow = { id: string; name: string; unit_price: number; quantity: number; pre_assigned_name: string | null }

export default async function ConfirmPage({ params }: Props) {
  const { id } = await params
  const db = createServerClient()

  const { data: session } = await db.from('sessions').select('*').eq('id', id).single()
  if (!session) notFound()

  const { data: items } = await db.from('items').select('*').eq('session_id', id).order('id')
  if (!items) notFound()

  if (session.status === 'done') redirect(`/session/${id}/summary`)

  const typedItems = items as ItemRow[]
  const isGroupOrder = session.bill_type === 'group_order'

  // Build person groups for group_order bills
  const personOrder: string[] = []
  const personGroups = new Map<string, ItemRow[]>()
  const unassigned: ItemRow[] = []

  for (const item of typedItems) {
    if (item.pre_assigned_name) {
      if (!personGroups.has(item.pre_assigned_name)) {
        personOrder.push(item.pre_assigned_name)
        personGroups.set(item.pre_assigned_name, [])
      }
      personGroups.get(item.pre_assigned_name)!.push(item)
    } else {
      unassigned.push(item)
    }
  }

  const hasGroups = personGroups.size > 0

  // Cross-check: Σ items vs ค่าอาหาร from the footer. A mismatch flags a likely
  // duplicate (diff > 0) or dropped (diff < 0) row from multi-image OCR merge.
  const reconcile = reconcileItems(typedItems, Number(session.food_subtotal))

  function ItemLine({ item }: { item: ItemRow }) {
    return (
      <div className="flex justify-between items-center px-4 py-3">
        <p className="text-sm font-medium text-ink flex-1 pr-3">{item.name}</p>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-ink">฿{(item.unit_price * item.quantity).toFixed(2)}</p>
          {item.quantity > 1 && (
            <p className="text-xs text-ink-faint">x{item.quantity} @ ฿{item.unit_price}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-ink-soft hover:text-ink-soft mb-6 inline-block">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold text-ink mb-1">ยืนยันรายการ</h1>
      <p className="text-sm text-ink-soft mb-4">ตรวจสอบรายการก่อนไปขั้นตอนถัดไป</p>

      {!reconcile.balanced && (
        <div className="mb-4 rounded-xl border border-[var(--warn)]/30 bg-warn-tint px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--warn)]">
            ⚠️ ยอดรายการไม่ตรงกับค่าอาหาร
          </p>
          <p className="text-ink-soft mt-0.5">
            รวมรายการได้ ฿{reconcile.itemsTotal.toFixed(2)} แต่บิลระบุค่าอาหาร ฿{reconcile.foodSubtotal.toFixed(2)}
            {' '}({reconcile.diff > 0 ? `เกิน ฿${reconcile.diff.toFixed(2)} — อาจมีรายการซ้ำ` : `ขาด ฿${(-reconcile.diff).toFixed(2)} — อาจมีรายการตกหล่น`})
          </p>
          <p className="text-ink-faint mt-1 text-xs">
            ตรวจสอบรายการด้านล่าง แล้วอัปโหลดรูปใหม่หากจำเป็น
          </p>
        </div>
      )}

      {hasGroups && isGroupOrder ? (
        <div className="space-y-3 mb-4">
          {personOrder.map(name => {
            const personItems = personGroups.get(name)!
            const subtotal = personItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            return (
              <div key={name} className="bg-surface rounded-xl border border-line overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-brand-tint border-b border-line">
                  <p className="text-sm font-semibold text-brand-ink">{name}</p>
                  <p className="text-xs font-medium text-brand-strong">฿{subtotal.toFixed(2)}</p>
                </div>
                <div className="divide-y divide-line">
                  {personItems.map(item => <ItemLine key={item.id} item={item} />)}
                </div>
              </div>
            )
          })}
          {unassigned.length > 0 && (
            <div className="bg-surface rounded-xl border border-line overflow-hidden">
              <div className="px-4 py-2 bg-canvas border-b border-line">
                <p className="text-sm font-semibold text-ink-soft">ไม่ระบุ</p>
              </div>
              <div className="divide-y divide-line">
                {unassigned.map(item => <ItemLine key={item.id} item={item} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-line divide-y divide-line mb-4">
          {typedItems.map(item => (
            <div key={item.id} className="flex justify-between items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">{item.name}</p>
                {item.pre_assigned_name && (
                  <p className="text-xs text-brand-strong mt-0.5">{item.pre_assigned_name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">
                  ฿{(item.unit_price * item.quantity).toFixed(2)}
                </p>
                {item.quantity > 1 && (
                  <p className="text-xs text-ink-faint">x{item.quantity} @ ฿{item.unit_price}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmActions
        sessionId={id}
        billType={session.bill_type}
        foodSubtotal={Number(session.food_subtotal)}
        deliveryFee={Number(session.delivery_fee)}
        totalDiscount={Number(session.total_discount)}
        grandTotal={Number(session.grand_total)}
        splitMode={Number(session.split_mode)}
        thaiHelpEnabled={Boolean(session.thai_help_enabled)}
        thaiHelpBalance={Number(session.thai_help_balance ?? 0)}
        extraCharges={(session.extra_charges ?? []) as Parameters<typeof ConfirmActions>[0]['extraCharges']}
      />
    </div>
  )
}
