'use client'

import { useMemo, useState } from 'react'
import { reconcileItems } from '@/lib/bill'
import ConfirmActions from './ConfirmActions'
import type { ExtraCharge } from '@/types'

export type EditableItem = {
  id: string
  name: string
  unit_price: number
  quantity: number
  pre_assigned_name: string | null
}

type SessionInfo = {
  id: string
  bill_type: string
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  food_discount: number
  grand_total: number
  split_mode: number
  thai_help_enabled: boolean
  thai_help_balance: number
  extra_charges: ExtraCharge[]
}

const num = (v: string) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

// One line item. Defined at module scope (not nested inside ConfirmClient) so it
// keeps a stable identity across renders — a nested component would remount on
// every keystroke and steal focus from the price input.
function EditableItemRow({
  item,
  editing,
  onToggle,
  onChange,
  showPreName,
}: {
  item: EditableItem
  editing: boolean
  onToggle: () => void
  onChange: (patch: Partial<EditableItem>) => void
  showPreName: boolean
}) {
  const lineTotal = item.unit_price * item.quantity
  return (
    <div className="px-4 py-3">
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{item.name}</p>
          {showPreName && item.pre_assigned_name && (
            <p className="text-xs text-brand-strong mt-0.5">{item.pre_assigned_name}</p>
          )}
          {!editing && item.quantity > 1 && (
            <p className="text-xs text-ink-faint mt-0.5">x{item.quantity} @ ฿{item.unit_price}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-sm font-semibold text-ink tnum">฿{lineTotal.toFixed(2)}</p>
          <button
            type="button"
            onClick={onToggle}
            aria-label={editing ? `เสร็จสิ้นการแก้ไข ${item.name}` : `แก้ไขราคา ${item.name}`}
            className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-colors ${
              editing
                ? 'bg-[var(--brand)] text-white'
                : 'text-ink-faint hover:text-brand-strong hover:bg-brand-tint/60'
            }`}
          >
            {editing ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <label className="text-xs text-ink-soft">
            <span className="block mb-1">ราคา/หน่วย</span>
            <div className="flex items-center gap-1">
              <span className="text-ink-faint">฿</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={item.unit_price}
                onChange={e => onChange({ unit_price: num(e.target.value) })}
                className="w-24 text-right border border-line rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>
          </label>
          <label className="text-xs text-ink-soft">
            <span className="block mb-1">จำนวน</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={item.quantity}
              onChange={e => onChange({ quantity: Math.max(1, Math.floor(num(e.target.value))) })}
              className="w-16 text-right border border-line rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default function ConfirmClient({
  session,
  items: initialItems,
}: {
  session: SessionInfo
  items: EditableItem[]
}) {
  const [items, setItems] = useState<EditableItem[]>(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)

  const isGroupOrder = session.bill_type === 'group_order'

  // Group items by their pre-assigned person (group_order bills). Derived from
  // the live item state so edits stay in sync.
  const { personOrder, personGroups, unassigned } = useMemo(() => {
    const personOrder: string[] = []
    const personGroups = new Map<string, EditableItem[]>()
    const unassigned: EditableItem[] = []
    for (const item of items) {
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
    return { personOrder, personGroups, unassigned }
  }, [items])

  const hasGroups = personGroups.size > 0

  // Live subtotal recomputed from the edited rows — feeds the totals + reconcile.
  const liveFoodSubtotal = useMemo(
    () => Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100) / 100,
    [items],
  )

  // Cross-check Σ items against the receipt's ค่าอาหาร footer. Editing prices to
  // fix an OCR slip makes this warning clear itself.
  const reconcile = reconcileItems(items, session.food_subtotal)

  function updateItem(id: string, patch: Partial<EditableItem>) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }
  function toggle(id: string) {
    setEditingId(prev => (prev === id ? null : id))
  }

  return (
    <>
      {!reconcile.balanced && (
        <div className="mb-4 rounded-xl border border-[var(--warn)]/30 bg-warn-tint px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--warn)]">⚠️ ยอดรายการไม่ตรงกับค่าอาหาร</p>
          <p className="text-ink-soft mt-0.5">
            รวมรายการได้ ฿{reconcile.itemsTotal.toFixed(2)} แต่บิลระบุค่าอาหาร ฿{reconcile.foodSubtotal.toFixed(2)}
            {' '}
            ({reconcile.diff > 0
              ? `เกิน ฿${reconcile.diff.toFixed(2)} — อาจมีรายการซ้ำ`
              : `ขาด ฿${(-reconcile.diff).toFixed(2)} — อาจมีรายการตกหล่น`})
          </p>
          <p className="text-ink-faint mt-1 text-xs">แตะปุ่มแก้ไขข้างรายการเพื่อปรับราคา หรืออัปโหลดรูปใหม่หากจำเป็น</p>
        </div>
      )}

      {hasGroups && isGroupOrder ? (
        <div className="space-y-3 mb-4">
          {personOrder.map(name => {
            const personItems = personGroups.get(name)!
            const subtotal = personItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            return (
              <div key={name} className="bg-surface rounded-3xl border border-line shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-brand-tint border-b border-line">
                  <p className="text-sm font-semibold text-brand-ink">{name}</p>
                  <p className="text-xs font-medium text-brand-strong">฿{subtotal.toFixed(2)}</p>
                </div>
                <div className="divide-y divide-line">
                  {personItems.map(item => (
                    <EditableItemRow
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      onToggle={() => toggle(item.id)}
                      onChange={patch => updateItem(item.id, patch)}
                      showPreName={false}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {unassigned.length > 0 && (
            <div className="bg-surface rounded-3xl border border-line shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="px-4 py-2 bg-canvas border-b border-line">
                <p className="text-sm font-semibold text-ink-soft">ไม่ระบุ</p>
              </div>
              <div className="divide-y divide-line">
                {unassigned.map(item => (
                  <EditableItemRow
                    key={item.id}
                    item={item}
                    editing={editingId === item.id}
                    onToggle={() => toggle(item.id)}
                    onChange={patch => updateItem(item.id, patch)}
                    showPreName={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface rounded-3xl border border-line shadow-[var(--shadow-sm)] divide-y divide-line mb-4">
          {items.map(item => (
            <EditableItemRow
              key={item.id}
              item={item}
              editing={editingId === item.id}
              onToggle={() => toggle(item.id)}
              onChange={patch => updateItem(item.id, patch)}
              showPreName
            />
          ))}
        </div>
      )}

      <ConfirmActions
        sessionId={session.id}
        billType={session.bill_type}
        foodSubtotal={liveFoodSubtotal}
        deliveryFee={session.delivery_fee}
        totalDiscount={session.total_discount}
        foodDiscount={session.food_discount}
        grandTotal={session.grand_total}
        splitMode={session.split_mode}
        thaiHelpEnabled={session.thai_help_enabled}
        thaiHelpBalance={session.thai_help_balance}
        extraCharges={session.extra_charges}
        items={items}
      />
    </>
  )
}
