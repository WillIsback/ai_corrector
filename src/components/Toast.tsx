import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface Props {
  toast: Toast | null
  onClose: () => void
}

export function Toast({ toast, onClose }: Props) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(onClose, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast, onClose])

  if (!toast) return null

  const getColorClass = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={`fixed top-6 right-6 px-6 py-4 rounded-lg shadow-lg text-white flex items-center gap-3 z-50 animate-fade-in-out ${getColorClass()}`}>
      <span>{toast.message}</span>
      <button onClick={onClose} className="opacity-75 hover:opacity-100">
        ✕
      </button>
    </div>
  )
}
