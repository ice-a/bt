import type { TorrentView } from '../types/api'

export interface FavoriteTorrent extends TorrentView {
  savedAt: string
}

export const FAVORITES_KEY = 'bt-favorites-v1'
export const MAX_FAVORITES = 1000
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** 仅保存展示信息与磁力链，避免把大文件清单写入浏览器存储。 */
export function toFavorite(input: unknown, now = new Date().toISOString()): FavoriteTorrent {
  if (!input || typeof input !== 'object') throw new Error('收藏数据格式无效')
  const item = input as Record<string, unknown>
  const infoHash = text(item.infoHash, 64).toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(infoHash)) throw new Error('收藏数据包含无效的 infoHash')
  const name = text(item.name) || infoHash
  const trackers: string[] = []
  const addTracker = (value: unknown) => {
    const candidate = text(value, 1000)
    try {
      const url = new URL(candidate)
      if (['http:', 'https:', 'udp:', 'ws:', 'wss:'].includes(url.protocol) && url.hostname && !trackers.includes(candidate) && trackers.length < 20) {
        trackers.push(candidate)
      }
    } catch { /* 忽略无效 tracker */ }
  }
  if (Array.isArray(item.trackers)) item.trackers.forEach(addTracker)
  try {
    const uri = new URL(text(item.magnet, 30000))
    if (uri.protocol === 'magnet:') uri.searchParams.getAll('tr').forEach(addTracker)
  } catch { /* infoHash 足以构造磁力链 */ }
  const params = new URLSearchParams({ xt: `urn:btih:${infoHash}`, dn: name })
  trackers.forEach((tracker) => params.append('tr', tracker))
  return {
    infoHash, name, magnet: `magnet:?${params}`, trackers,
    size: numberOrNull(item.size) ?? 0,
    seeders: numberOrNull(item.seeders), leechers: numberOrNull(item.leechers),
    fileCount: numberOrNull(item.fileCount) ?? (Array.isArray(item.files) ? item.files.length : null),
    files: null,
    source: text(item.source, 100), sourceLabel: text(item.sourceLabel, 100),
    category: text(item.category, 100) || null,
    addedAt: dateOrNull(item.addedAt), creationDate: dateOrNull(item.creationDate),
    savedAt: dateOrNull(item.savedAt) || now
  }
}

export function parseFavorites(raw: string): FavoriteTorrent[] {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('收藏备份不能超过 2 MB')
  let data: { version?: unknown; items?: unknown }
  try { data = JSON.parse(raw) } catch { throw new Error('收藏备份不是有效的 JSON 文件') }
  if (!data || data.version !== 1 || !Array.isArray(data.items)) throw new Error('收藏备份格式不受支持')
  if (data.items.length > MAX_FAVORITES) throw new Error('收藏数量不能超过 1000 条')
  const unique = new Map<string, FavoriteTorrent>()
  for (const item of data.items) {
    const normalized = toFavorite(item)
    if (!unique.has(normalized.infoHash)) unique.set(normalized.infoHash, normalized)
  }
  return [...unique.values()]
}

export function serializeFavorites(items: FavoriteTorrent[]): string {
  const raw = JSON.stringify({ version: 1, items })
  if (items.length > MAX_FAVORITES) throw new Error('收藏数量不能超过 1000 条')
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('收藏备份不能超过 2 MB')
  return raw
}

/** 导入时保留已有收藏，只追加未收藏的条目。 */
export function mergeFavorites(existing: FavoriteTorrent[], incoming: FavoriteTorrent[]): FavoriteTorrent[] {
  const known = new Set(existing.map((item) => item.infoHash))
  const merged = [...existing]
  for (const item of incoming) {
    if (!known.has(item.infoHash)) {
      merged.push(item)
      known.add(item.infoHash)
    }
  }
  serializeFavorites(merged)
  return merged
}
