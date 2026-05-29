import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'
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

  function ItemLine({ item }: { item: ItemRow }) {
    return (
      <div className="flex justify-between items-center px-4 py-3">
        <p className="text-sm font-medium text-gray-800 flex-1 pr-3">{item.name}</p>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">฿{(item.unit_price * item.quantity).toFixed(2)}</p>
          {item.quantity > 1 && (
            <p className="text-xs text-gray-400">x{item.quantity} @ ฿{item.unit_price}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">ยืนยันรายการ</h1>
      <p className="text-sm text-gray-500 mb-4">ตรวจสอบรายการก่อนไปขั้นตอนถัดไป</p>

      {hasGroups && isGroupOrder ? (
        <div className="space-y-3 mb-4">
          {personOrder.map(name => {
            const personItems = personGroups.get(name)!
            const subtotal = personItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            return (
              <div key={name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-indigo-50 border-b border-indigo-100">
                  <p className="text-sm font-semibold text-indigo-700">{name}</p>
                  <p className="text-xs font-medium text-indigo-500">฿{subtotal.toFixed(2)}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {personItems.map(item => <ItemLine key={item.id} item={item} />)}
                </div>
              </div>
            )
          })}
          {unassigned.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-500">ไม่ระบุ</p>
              </div>
              <div className="divide-y divide-gray-100">
                {unassigned.map(item => <ItemLine key={item.id} item={item} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
          {typedItems.map(item => (
            <div key={item.id} className="flex justify-between items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                {item.pre_assigned_name && (
                  <p className="text-xs text-indigo-600 mt-0.5">{item.pre_assigned_name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  ฿{(item.unit_price * item.quantity).toFixed(2)}
                </p>
                {item.quantity > 1 && (
                  <p className="text-xs text-gray-400">x{item.quantity} @ ฿{item.unit_price}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-1.5 text-sm mb-6">
        {session.food_subtotal > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>ค่าอาหาร</span><span>฿{Number(session.food_subtotal).toFixed(2)}</span>
          </div>
        )}
        {session.delivery_fee > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>ค่าจัดส่ง</span><span>฿{Number(session.delivery_fee).toFixed(2)}</span>
          </div>
        )}
        {session.total_discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>ส่วนลด</span><span>-฿{Number(session.total_discount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
          <span>รวมทั้งหมด</span><span>฿{Number(session.grand_total).toFixed(2)}</span>
        </div>
      </div>

      <ConfirmActions sessionId={id} billType={session.bill_type} />
    </div>
  )
}
