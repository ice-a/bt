import type { TorrentView } from '../types/api'

export type TorrentSort = 'seeders' | 'size-desc' | 'size-asc' | 'newest' | 'name' | 'saved'
export interface TorrentFilters {
  text: string
  source: string
  size: string
  seeded: boolean
  sort: TorrentSort
}

const GiB = 1024 ** 3
const timestamp = (value?: string | null) => value ? Date.parse(value) || 0 : 0

export function filterTorrents<T extends TorrentView & { savedAt?: string }>(items: readonly T[], filters: TorrentFilters): T[] {
  const query = filters.text.trim().toLocaleLowerCase()
  return items.filter((item) => {
    if (query && !`${item.name} ${item.infoHash}`.toLocaleLowerCase().includes(query)) return false
    if (filters.source && (item.source || 'unknown') !== filters.source) return false
    if (filters.seeded && !(Number(item.seeders) > 0)) return false
    if (filters.size === 'small' && !(item.size > 0 && item.size < GiB)) return false
    if (filters.size === 'medium' && !(item.size >= GiB && item.size < 10 * GiB)) return false
    if (filters.size === 'large' && !(item.size >= 10 * GiB)) return false
    return true
  }).sort((a, b) => {
    switch (filters.sort) {
      case 'size-desc': return (b.size || 0) - (a.size || 0)
      case 'size-asc': return (a.size > 0 ? a.size : Infinity) - (b.size > 0 ? b.size : Infinity)
      case 'newest': return timestamp(b.addedAt || b.creationDate) - timestamp(a.addedAt || a.creationDate)
      case 'name': return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
      case 'saved': return timestamp(b.savedAt) - timestamp(a.savedAt)
      default: return (b.seeders ?? -1) - (a.seeders ?? -1)
    }
  })
}
