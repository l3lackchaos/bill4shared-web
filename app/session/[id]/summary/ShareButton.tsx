'use client'

import { useToast } from '../../../Toast'

// Copies (or natively shares) the read-only /share/<id> link so friends can open
// the bill and see what they owe without touching the editor.
export default function ShareButton({ sessionId }: { sessionId: string }) {
  const toast = useToast()

  async function share() {
    const url = `${window.location.origin}/share/${sessionId}`
    // Prefer the native share sheet on mobile; fall back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'สรุปบิล Bill4Shared', url })
        return
      } catch {
        // user cancelled or share failed → fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('คัดลอกลิงก์แล้ว — ส่งให้เพื่อนเปิดดูได้เลย')
    } catch {
      toast('คัดลอกลิงก์ไม่สำเร็จ', { kind: 'error' })
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold bg-[image:var(--brand-grad)] text-white shadow-[var(--shadow-md)] hover:brightness-105 active:scale-[0.98] transition-all duration-200"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zm12 7a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
      แชร์ลิงก์ให้เพื่อน
    </button>
  )
}
