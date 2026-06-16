'use client'

import { useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function UploadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addFiles = useCallback((newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...images])
    images.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }, [])

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function upload() {
    if (files.length === 0) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      files.forEach(f => form.append('images', f))
      const res = await fetch(`/api/sessions/${id}/upload`, { method: 'POST', body: form })
      if (!res.ok) {
        // Map server/OCR failures to a friendly, actionable Thai message.
        const msg =
          res.status >= 500
            ? 'อ่านบิลไม่สำเร็จ — รูปอาจไม่ชัดหรือระบบขัดข้อง ลองถ่ายใหม่ให้เห็นรายการชัดๆ แล้วลองอีกครั้ง'
            : 'อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง'
        throw new Error(msg)
      }
      router.push(`/session/${id}/confirm`)
    } catch (e: unknown) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      setError(
        offline
          ? 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต ตรวจสอบสัญญาณแล้วลองใหม่'
          : e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง',
      )
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink pt-8 mb-5 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        หน้าแรก
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-1">อัปโหลดรูปบิล</h1>
      <p className="text-sm text-ink-faint mb-7">ส่งได้หลายรูปถ้าบิลมีหลายหน้า</p>

      <div
        role="button"
        tabIndex={0}
        aria-label="เลือกหรือลากรูปบิลมาวางเพื่ออัปโหลด"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles([...e.dataTransfer.files]) }}
        className="border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-[var(--brand)] hover:bg-brand-tint/50 transition-colors"
        onClick={() => document.getElementById('file-input')?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            document.getElementById('file-input')?.click()
          }
        }}
      >
        <svg className="w-9 h-9 mx-auto mb-2 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 14.25h.008v.008H18v-.008z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 19.5h-15A2.25 2.25 0 012.25 17.25V6.75z" />
        </svg>
        <p className="text-sm text-ink-soft">ลากรูปมาวาง หรือแตะเพื่อเลือก</p>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => addFiles([...(e.target.files ?? [])])}
        />
      </div>

      {previews.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 list-none p-0">
          {previews.map((src, i) => (
            <li key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`รูปบิลที่ ${i + 1}`} className="w-full h-32 object-cover rounded-lg border border-line" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={`ลบรูปบิลที่ ${i + 1}`}
                className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={upload}
        disabled={files.length === 0 || loading}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[var(--brand)] text-white py-3 rounded-full font-semibold shadow-[var(--shadow-md)] hover:bg-[var(--brand-strong)] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all duration-200"
      >
        {loading ? 'กำลัง OCR รูปบิล...' : `วิเคราะห์บิล (${files.length} รูป)`}
      </button>
    </div>
  )
}
