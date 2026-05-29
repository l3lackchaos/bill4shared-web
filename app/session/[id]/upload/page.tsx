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
        const d = await res.json()
        throw new Error(d.error ?? 'Upload failed')
      }
      router.push(`/session/${id}/confirm`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">อัปโหลดรูปบิล</h1>
      <p className="text-sm text-gray-500 mb-6">ส่งได้หลายรูปถ้าบิลมีหลายหน้า</p>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles([...e.dataTransfer.files]) }}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 transition-colors"
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <p className="text-3xl mb-2">📷</p>
        <p className="text-sm text-gray-600">ลากรูปมาวาง หรือคลิกเพื่อเลือก</p>
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
        <div className="mt-4 grid grid-cols-2 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-32 object-cover rounded-lg border" />
              <button
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-black"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={upload}
        disabled={files.length === 0 || loading}
        className="mt-6 w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {loading ? 'กำลัง OCR รูปบิล...' : `วิเคราะห์บิล (${files.length} รูป)`}
      </button>
    </div>
  )
}
