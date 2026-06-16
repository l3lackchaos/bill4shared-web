'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  kind: ToastKind
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

// useToast() returns a function: toast('บันทึกแล้ว') / toast('ผิดพลาด', 'error')
export function useToast() {
  return useContext(ToastContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, kind }])
    // Auto-dismiss after 2.6s
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[var(--z-toast)] flex flex-col items-center gap-2 pointer-events-none w-full px-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex items-center gap-2 max-w-sm rounded-full pl-3 pr-4 py-2.5 text-sm font-medium shadow-[var(--shadow-lg)] bg-surface border border-line"
          >
            <span
              className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${
                t.kind === 'success'
                  ? 'bg-[var(--brand)] text-white'
                  : t.kind === 'error'
                    ? 'bg-[var(--neg)] text-white'
                    : 'bg-line text-ink'
              }`}
            >
              {t.kind === 'error' ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
