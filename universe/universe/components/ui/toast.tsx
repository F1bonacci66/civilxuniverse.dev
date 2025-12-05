'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

function ToastComponent({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration || 3000
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  }

  const styles = {
    success: 'bg-green-500/10 border-green-500/50 text-green-400',
    error: 'bg-red-500/10 border-red-500/50 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
  }

  const Icon = icons[toast.type]

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg min-w-[300px] max-w-[500px] animate-in slide-in-from-right',
        styles[toast.type]
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="text-current/60 hover:text-current transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

let toastIdCounter = 0
const toasts: Toast[] = []
let listeners: Array<(toasts: Toast[]) => void> = []

function addToast(toast: Omit<Toast, 'id'>) {
  const id = `toast-${++toastIdCounter}`
  const newToast: Toast = { ...toast, id }
  toasts.push(newToast)
  listeners.forEach((listener) => listener([...toasts]))
  return id
}

function removeToast(id: string) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index > -1) {
    toasts.splice(index, 1)
    listeners.forEach((listener) => listener([...toasts]))
  }
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToastList(newToasts)
    }
    listeners.push(listener)
    setToastList([...toasts])

    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
    return addToast({ message, type, duration })
  }

  const closeToast = (id: string) => {
    removeToast(id)
  }

  return {
    toasts: toastList,
    showToast,
    closeToast,
  }
}

export function ToastContainer() {
  const { toasts, closeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent toast={toast} onClose={closeToast} />
        </div>
      ))}
    </div>
  )
}

