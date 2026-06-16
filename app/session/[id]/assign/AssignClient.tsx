'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Item {
  id: string
  name: string
  unit_price: number
  quantity: number
  assignments: { display_name: string; share_numerator: number; share_denominator: number }[]
}

interface Session {
  id: string
  split_mode: number
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  grand_total: number
}

export default function AssignClient({
  sessionId,
  session,
  items,
}: {
  sessionId: string
  session: Session
  items: Item[]
}) {
  const router = useRouter()

  const [assignments, setAssignments] = useState<
    Record<string, { display_name: string; share_numerator: number; share_denominator: number }[]>
  >(() =>
    Object.fromEntries(
      items.map(item => [item.id, item.assignments ?? []]),
    ),
  )

  const [personInput, setPersonInput] = useState<Record<string, string>>({})
  // Which items currently have the "add person" input box open.
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  function openAdd(itemId: string) {
    setAdding(prev => ({ ...prev, [itemId]: true }))
  }

  function addPerson(itemId: string) {
    const name = (personInput[itemId] ?? '').trim()
    if (!name) return
    setAssignments(prev => {
      const existing = prev[itemId] ?? []
      if (existing.some(a => a.display_name === name)) return prev
      const updated = [...existing, { display_name: name, share_numerator: 1, share_denominator: 1 }]
      const n = updated.length
      return { ...prev, [itemId]: updated.map(a => ({ ...a, share_denominator: n })) }
    })
    setPersonInput(prev => ({ ...prev, [itemId]: '' }))
    // keep the box open so adding several people in a row stays fast
  }

  function removePerson(itemId: string, displayName: string) {
    setAssignments(prev => {
      const updated = (prev[itemId] ?? []).filter(a => a.display_name !== displayName)
      const n = updated.length
      return { ...prev, [itemId]: updated.map(a => ({ ...a, share_denominator: n || 1 })) }
    })
  }

  async function finalize() {
    setLoading(true)
    const allAssignments = Object.entries(assignments).flatMap(([item_id, asgns]) =>
      asgns.map(a => ({ item_id, ...a })),
    )

    await fetch(`/api/sessions/${sessionId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: allAssignments }),
    })

    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })

    router.push(`/session/${sessionId}/summary`)
  }

  const totalAssigned = Object.values(assignments).filter(a => a.length > 0).length

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">แบ่งรายการ</h1>
      <p className="text-sm text-gray-500 mb-6">
        ระบุชื่อคนที่สั่งแต่ละรายการ แบ่งหลายคนได้
      </p>

      <div className="space-y-3 mb-6">
        {items.map(item => {
          const asgns = assignments[item.id] ?? []
          const itemTotal = item.unit_price * item.quantity
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between mb-3">
                <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                <p className="text-sm font-semibold text-gray-900">
                  ฿{itemTotal.toFixed(2)}
                </p>
              </div>

              {asgns.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {asgns.map(a => (
                    <span
                      key={a.display_name}
                      className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
                    >
                      {a.display_name}
                      {asgns.length > 1 && (
                        <span className="text-indigo-400">
                          (฿{(itemTotal / asgns.length).toFixed(0)})
                        </span>
                      )}
                      <button
                        onClick={() => removePerson(item.id, a.display_name)}
                        className="text-indigo-400 hover:text-indigo-600 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {adding[item.id] ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="ใส่ชื่อคนหาร..."
                    value={personInput[item.id] ?? ''}
                    onChange={e => setPersonInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addPerson(item.id)
                      if (e.key === 'Escape') setAdding(prev => ({ ...prev, [item.id]: false }))
                    }}
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => addPerson(item.id)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700"
                  >
                    เพิ่ม
                  </button>
                  <button
                    onClick={() => setAdding(prev => ({ ...prev, [item.id]: false }))}
                    className="text-gray-400 hover:text-gray-600 px-1 text-xs"
                  >
                    เสร็จ
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openAdd(item.id)}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                >
                  <span className="text-base leading-none">+</span> เพิ่มคนหาร
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm mb-6 space-y-1">
        {session.delivery_fee > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>ค่าจัดส่ง</span><span>฿{Number(session.delivery_fee).toFixed(2)}</span>
          </div>
        )}
        {session.total_discount > 0 && (
          <div className="flex justify-between text-red-500">
            <span>ส่วนลด</span><span>-฿{Number(session.total_discount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
          <span>รวม</span><span>฿{Number(session.grand_total).toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={finalize}
        disabled={loading || totalAssigned === 0}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {loading ? 'กำลังคำนวณ...' : `คำนวณบิล (${totalAssigned}/${items.length} รายการ)`}
      </button>
    </div>
  )
}
