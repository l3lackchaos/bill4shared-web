'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Assignment {
  display_name: string
  share_numerator: number
  share_denominator: number
}

interface Item {
  id: string
  name: string
  unit_price: number
  quantity: number
  assignments: Assignment[]
}

interface Session {
  id: string
  split_mode: number
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  grand_total: number
}

// A person on an item in the editor. `amount` is what they pay for this item;
// it's only authoritative in 'custom' mode — in 'equal' mode we recompute it as
// itemTotal / headcount on the fly.
interface Person {
  name: string
  amount: number
}

type ItemMode = 'equal' | 'custom'

const round2 = (n: number) => Math.round(n * 100) / 100

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

  const itemTotalOf = (it: Item) => round2(it.unit_price * it.quantity)

  // Reconstruct editor state from stored assignments. An assignment is just a
  // fraction (num/den) of the item total; amount = itemTotal × num/den. If every
  // person is an equal 1/n split we start in 'equal' mode, otherwise 'custom'.
  const [people, setPeople] = useState<Record<string, Person[]>>(() =>
    Object.fromEntries(
      items.map(it => {
        const total = itemTotalOf(it)
        const list = (it.assignments ?? []).map(a => ({
          name: a.display_name,
          amount: round2(total * (a.share_numerator / a.share_denominator)),
        }))
        return [it.id, list]
      }),
    ),
  )

  const [mode, setMode] = useState<Record<string, ItemMode>>(() =>
    Object.fromEntries(
      items.map(it => {
        const a = it.assignments ?? []
        const n = a.length
        const isEqual = n > 0 && a.every(x => x.share_numerator === 1 && x.share_denominator === n)
        return [it.id, n > 0 && !isEqual ? 'custom' : 'equal']
      }),
    ),
  )

  const [nameInput, setNameInput] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const num = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  // In equal mode, everyone pays itemTotal / headcount. Compute on demand so it
  // stays correct as people are added/removed.
  function equalAmount(itemId: string): number {
    const total = itemTotalOf(items.find(i => i.id === itemId)!)
    const n = (people[itemId] ?? []).length
    return n > 0 ? round2(total / n) : 0
  }

  function addPerson(itemId: string) {
    const name = (nameInput[itemId] ?? '').trim()
    if (!name) return
    setPeople(prev => {
      const existing = prev[itemId] ?? []
      if (existing.some(p => p.name === name)) return prev
      return { ...prev, [itemId]: [...existing, { name, amount: 0 }] }
    })
    setNameInput(prev => ({ ...prev, [itemId]: '' }))
  }

  function removePerson(itemId: string, name: string) {
    setPeople(prev => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter(p => p.name !== name) }))
  }

  function setPersonAmount(itemId: string, name: string, amount: number) {
    setPeople(prev => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).map(p => (p.name === name ? { ...p, amount } : p)),
    }))
  }

  async function finalize() {
    setLoading(true)

    const allAssignments = items.flatMap(it => {
      const list = people[it.id] ?? []
      if (list.length === 0) return []
      const total = itemTotalOf(it)
      const m = mode[it.id] ?? 'equal'

      if (m === 'equal') {
        const n = list.length
        return list.map(p => ({
          item_id: it.id,
          display_name: p.name,
          share_numerator: 1,
          share_denominator: n,
        }))
      }

      // custom: turn each person's baht amount into a fraction of the item total.
      // num/den must be integers (DB columns), so scale by 100 to keep satang.
      const den = Math.max(1, Math.round(total * 100))
      return list.map(p => ({
        item_id: it.id,
        display_name: p.name,
        share_numerator: Math.max(0, Math.round(p.amount * 100)),
        share_denominator: den,
      }))
    })

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

  const totalAssigned = items.filter(it => (people[it.id] ?? []).length > 0).length

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">แบ่งรายการ</h1>
      <p className="text-sm text-gray-500 mb-6">
        ระบุชื่อคนที่สั่งแต่ละรายการ — หารเท่ากัน หรือระบุราคาเองก็ได้
      </p>

      <div className="space-y-3 mb-6">
        {items.map(item => {
          const list = people[item.id] ?? []
          const itemTotal = itemTotalOf(item)
          const m = mode[item.id] ?? 'equal'
          const customSum = round2(list.reduce((s, p) => s + p.amount, 0))
          const mismatch = m === 'custom' && list.length > 0 && Math.abs(customSum - itemTotal) > 0.01

          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-3">
                <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                <p className="text-sm font-semibold text-gray-900">฿{itemTotal.toFixed(2)}</p>
              </div>

              {/* mode toggle */}
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 mb-3 text-xs">
                {(['equal', 'custom'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setMode(prev => ({ ...prev, [item.id]: opt }))}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      m === opt ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt === 'equal' ? 'หารเท่ากัน' : 'ระบุราคา'}
                  </button>
                ))}
              </div>

              {list.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {list.map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700">{p.name}</span>
                      {m === 'equal' ? (
                        <span className="text-xs text-gray-400">฿{equalAmount(item.id).toFixed(2)}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">฿</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={p.amount || ''}
                            placeholder="0"
                            onChange={e => setPersonAmount(item.id, p.name, num(e.target.value))}
                            className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      )}
                      <button
                        onClick={() => removePerson(item.id, p.name)}
                        className="text-gray-300 hover:text-red-500 text-sm px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {m === 'custom' && (
                    <div className={`flex justify-between text-xs pt-1.5 mt-1 border-t border-gray-100 ${mismatch ? 'text-amber-600' : 'text-gray-400'}`}>
                      <span>รวมที่ระบุ</span>
                      <span>
                        ฿{customSum.toFixed(2)} / ฿{itemTotal.toFixed(2)}
                        {mismatch && (customSum > itemTotal ? ' (เกิน)' : ' (ขาด)')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {adding[item.id] ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="ใส่ชื่อคนหาร..."
                    value={nameInput[item.id] ?? ''}
                    onChange={e => setNameInput(prev => ({ ...prev, [item.id]: e.target.value }))}
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
                  onClick={() => setAdding(prev => ({ ...prev, [item.id]: true }))}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-medium mt-1"
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
