export type ToastKind = 'info' | 'ok' | 'err' | 'warn'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}

let seq = 0

export function useToasts() {
  return useState<Toast[]>('toasts', () => [])
}

export function dismissToast(id: number) {
  const toasts = useToasts()
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function pushToast(kind: ToastKind, title: string, detail?: string, ttl = 5200) {
  const toasts = useToasts()
  const id = ++seq
  toasts.value = [...toasts.value, { id, kind, title, detail }]
  if (import.meta.client && ttl > 0) {
    setTimeout(() => dismissToast(id), ttl)
  }
  return id
}

/** 从 $fetch 抛出的错误里抠出可读信息 */
export function errorMessage(err: unknown): string {
  const e = err as { statusMessage?: string; data?: { statusMessage?: string; message?: string }; message?: string }
  return (
    e?.data?.statusMessage ||
    e?.statusMessage ||
    e?.data?.message ||
    e?.message ||
    '请求失败'
  )
}
