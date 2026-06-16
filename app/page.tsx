import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import type { BillSession } from '@/types'

// Render per-request: this page lists live sessions from Supabase, so it must
// not be prerendered at build time (env vars aren't present then → build fails).
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  collecting: 'กำลังรับรูป',
  confirming: 'รอยืนยัน',
  assigning: 'แบ่งรายการ',
  done: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

const STATUS_COLOR: Record<string, string> = {
  collecting: 'bg-blue-100 text-blue-700',
  confirming: 'bg-yellow-100 text-yellow-700',
  assigning: 'bg-orange-100 text-orange-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

async function getSessions(): Promise<BillSession[]> {
  const db = createServerClient()
  const { data } = await db
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as BillSession[]
}

export default async function HomePage() {
  const sessions = await getSessions()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill4Shared</h1>
          <p className="text-gray-500 text-sm mt-0.5">แตกบิลง่ายๆ จากรูปใบเสร็จ</p>
        </div>
        <Link
          href="/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + บิลใหม่
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-500">ยังไม่มีบิล — กด &ldquo;บิลใหม่&rdquo; เพื่อเริ่ม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="block bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    บิล {new Date(s.created_at).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.created_at).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800">
                    {s.grand_total > 0 ? `฿${s.grand_total.toFixed(0)}` : '—'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
