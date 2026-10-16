export function formatBytes(bytes: number | null | undefined, digits = 2): string {
  const value = Number(bytes)
  if (!value || value < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let index = 0
  let n = value
  while (n >= 1024 && index < units.length - 1) {
    n /= 1024
    index++
  }
  return `${n.toFixed(index === 0 ? 0 : digits)} ${units[index]}`
}

export function formatDate(input: string | number | Date | null | undefined): string {
  if (!input) return '—'
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

export function formatRelative(input: string | number | Date | null | undefined): string {
  if (!input) return '—'
  const date = input instanceof Date ? input : new Date(input)
  const diff = Date.now() - date.getTime()
  if (Number.isNaN(diff)) return '—'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return formatDate(date)
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US')
}

export function filePercent(length: number, total: number): string {
  if (!total) return '0%'
  const pct = (length / total) * 100
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`
}

/** 把扁平的文件路径拆成 目录 + 文件名，便于展示层级 */
export function splitPath(path: string): { dir: string; name: string } {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return { dir: '', name: path }
  return { dir: path.slice(0, idx + 1), name: path.slice(idx + 1) }
}

/** 可以尝试在线预览的图片扩展名 */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']

/** 与服务端 preview 接口保持一致：超过这个大小就不做在线预览 */
export const MAX_IMAGE_PREVIEW_BYTES = 12 * 1024 * 1024

export function isImagePath(path: string): boolean {
  const idx = path.lastIndexOf('.')
  if (idx < 0) return false
  return IMAGE_EXTENSIONS.includes(path.slice(idx + 1).toLowerCase())
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
