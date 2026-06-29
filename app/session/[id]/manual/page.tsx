import Link from 'next/link'
import ManualForm from './ManualForm'

type Props = { params: Promise<{ id: string }> }

export default async function ManualEntryPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink pt-8 mb-5 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        หน้าแรก
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">กรอกบิลเอง</h1>
      <p className="text-sm text-ink-faint mb-7">เพิ่มรายการอาหารและยอดต่างๆ ด้วยตัวเอง ไม่ต้องถ่ายรูป</p>

      <ManualForm sessionId={id} />
    </div>
  )
}
