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

  // Roster = every distinct person who appears on any item. Used for quick-add
  // chips and for the "equal split with no names → split among everyone" rule.
  const roster = (() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const list of Object.values(people)) {
      for (const p of list) {
        if (!seen.has(p.name)) { seen.add(p.name); names.push(p.name) }
      }
    }
    return names
  })()

  // The people an item is actually split among. In equal mode with nobody picked,
  // it falls back to the whole roster (auto split among everyone).
  function effectiveNames(itemId: string): string[] {
    const list = people[itemId] ?? []
    if (list.length > 0) return list.map(p => p.name)
    if ((mode[itemId] ?? 'equal') === 'equal') return roster
    return []
  }

  // In equal mode, everyone pays itemTotal / headcount. Compute on demand so it
  // stays correct as people are added/removed (or via the roster fallback).
  function equalAmount(itemId: string): number {
    const total = itemTotalOf(items.find(i => i.id === itemId)!)
    const n = effectiveNames(itemId).length
    return n > 0 ? round2(total / n) : 0
  }

  function addNamed(itemId: string, rawName: string) {
    const name = rawName.trim()
    if (!name) return
    setPeople(prev => {
      const existing = prev[itemId] ?? []
      if (existing.some(p => p.name === name)) return prev
      return { ...prev, [itemId]: [...existing, { name, amount: 0 }] }
    })
  }

  function addPerson(itemId: string) {
    addNamed(itemId, nameInput[itemId] ?? '')
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
      const total = itemTotalOf(it)
      const m = mode[it.id] ?? 'equal'

      if (m === 'equal') {
        // No one picked + equal mode → split among everyone in the bill (roster).
        const names = list.length > 0 ? list.map(p => p.name) : roster
        if (names.length === 0) return []
        const n = names.length
        return names.map(name => ({
          item_id: it.id,
          display_name: name,
          share_numerator: 1,
          share_denominator: n,
        }))
      }

      if (list.length === 0) return []

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

  // An item counts as assigned if it has picked people, or equal-mode falls back
  // to the roster (so "ราเมง — หารเท่ากัน, ไม่เลือกใคร" still counts).
  const totalAssigned = items.filter(it => effectiveNames(it.id).length > 0).length

  // Running total of item value that has been assigned to someone, vs the whole
  // food subtotal — lets the user see at a glance whether the bill is fully split.
  const foodTotal = round2(items.reduce((s, it) => s + itemTotalOf(it), 0))
  const assignedTotal = round2(
    items.reduce((s, it) => (effectiveNames(it.id).length > 0 ? s + itemTotalOf(it) : s), 0),
  )
  const allCovered = Math.abs(assignedTotal - foodTotal) < 0.01 && foodTotal > 0
  const pct = foodTotal > 0 ? Math.min(100, Math.round((assignedTotal / foodTotal) * 100)) : 0

  return (
    <div className="max-w-lg mx-auto px-4 pb-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink pt-8 mb-5 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        หน้าแรก
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">แบ่งรายการ</h1>
      <p className="text-sm text-ink-faint mb-7">
        ระบุชื่อคนที่สั่งแต่ละรายการ หารเท่ากันหรือระบุราคาเองก็ได้
      </p>

      <div className="space-y-3 mb-6">
        {items.map(item => {
          const list = people[item.id] ?? []
          const itemTotal = itemTotalOf(item)
          const m = mode[item.id] ?? 'equal'
          const customSum = round2(list.reduce((s, p) => s + p.amount, 0))
          const mismatch = m === 'custom' && list.length > 0 && Math.abs(customSum - itemTotal) > 0.01

          return (
            <div key={item.id} className="bg-surface rounded-3xl border border-line shadow-[var(--shadow-sm)] p-4">
              <div className="flex justify-between items-start mb-3">
                <p className="font-medium text-ink text-sm">{item.name}</p>
                <p className="text-sm font-semibold text-ink">฿{itemTotal.toFixed(2)}</p>
              </div>

              {/* mode toggle */}
              <div className="inline-flex rounded-lg border border-line p-0.5 mb-3 text-xs">
                {(['equal', 'custom'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setMode(prev => ({ ...prev, [item.id]: opt }))}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      m === opt ? 'bg-[var(--brand)] text-white' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {opt === 'equal' ? 'หารเท่ากัน' : 'ระบุราคา'}
                  </button>
                ))}
              </div>

              {/* Equal mode + nobody picked → auto split among everyone (roster) */}
              {list.length === 0 && m === 'equal' && roster.length > 0 && (
                <p className="text-xs text-ink-faint mb-2">
                  หารเท่ากันทุกคน ({roster.length} คน) — คนละ ฿{equalAmount(item.id).toFixed(2)}
                </p>
              )}

              {list.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {list.map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-ink-soft">{p.name}</span>
                      {m === 'equal' ? (
                        <span className="text-xs text-ink-faint">฿{equalAmount(item.id).toFixed(2)}</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-ink-faint">฿</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={p.amount || ''}
                            placeholder="0"
                            onChange={e => setPersonAmount(item.id, p.name, num(e.target.value))}
                            className="w-20 text-right border border-line rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePerson(item.id, p.name)}
                        aria-label={`ลบ ${p.name} ออกจาก ${item.name}`}
                        className="text-ink-faint hover:text-red-500 w-7 h-7 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {m === 'custom' && (
                    <div className={`flex justify-between text-xs pt-1.5 mt-1 border-t border-line ${mismatch ? 'text-amber-600' : 'text-ink-faint'}`}>
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
                <div className="mt-2 space-y-2">
                  {/* Quick-add: tap a name already used elsewhere in this bill */}
                  {(() => {
                    const onItem = new Set(list.map(p => p.name))
                    const suggestions = roster.filter(nm => !onItem.has(nm))
                    if (suggestions.length === 0) return null
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map(nm => (
                          <button
                            key={nm}
                            onClick={() => addNamed(item.id, nm)}
                            className="inline-flex items-center gap-1 bg-canvas hover:bg-brand-tint text-ink-soft hover:text-brand-ink text-xs px-2 py-1 rounded-full transition-colors"
                          >
                            <span className="text-[var(--brand)]">+</span> {nm}
                          </button>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="flex gap-2">
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
                      className="flex-1 border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    />
                    <button
                      onClick={() => addPerson(item.id)}
                      className="bg-[image:var(--brand-grad)] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:brightness-105"
                    >
                      เพิ่ม
                    </button>
                    <button
                      onClick={() => setAdding(prev => ({ ...prev, [item.id]: false }))}
                      className="text-ink-faint hover:text-ink-soft px-1 text-xs"
                    >
                      เสร็จ
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(prev => ({ ...prev, [item.id]: true }))}
                  className="inline-flex items-center gap-1 text-[var(--brand-strong)] hover:text-[var(--brand)] text-xs font-medium mt-1"
                >
                  <span className="text-base leading-none">+</span> เพิ่มคนหาร
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-canvas rounded-3xl border border-line px-4 py-3 text-sm mb-6 space-y-2">
        {/* Running coverage — how much of the food has been assigned */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-ink-soft">แบ่งแล้ว</span>
            <span className={`tnum font-medium ${allCovered ? 'text-[var(--brand-strong)]' : 'text-ink'}`}>
              ฿{assignedTotal.toFixed(2)} / ฿{foodTotal.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {session.delivery_fee > 0 && (
          <div className="flex justify-between text-ink-soft pt-1">
            <span>ค่าจัดส่ง</span><span className="tnum">฿{Number(session.delivery_fee).toFixed(2)}</span>
          </div>
        )}
        {session.total_discount > 0 && (
          <div className="flex justify-between text-[var(--neg)]">
            <span>ส่วนลด</span><span className="tnum">-฿{Number(session.total_discount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-ink pt-1 border-t border-line">
          <span>รวม</span><span className="tnum">฿{Number(session.grand_total).toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={finalize}
        disabled={loading || totalAssigned === 0}
        className="w-full bg-[image:var(--brand-grad)] text-white py-3 rounded-full font-semibold shadow-[var(--shadow-md)] hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 clay-press transition-all duration-200"
      >
        {loading ? 'กำลังคำนวณ...' : `คำนวณบิล (${totalAssigned}/${items.length} รายการ)`}
      </button>
    </div>
  )
}
