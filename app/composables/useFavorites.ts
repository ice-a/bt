import type { TorrentView } from '~/types/api'
import { FAVORITES_KEY, mergeFavorites, parseFavorites, serializeFavorites, toFavorite, type FavoriteTorrent } from '~/utils/favorites'
import { translateText } from '~/utils/i18n'

export function useFavorites() {
  const favorites = useState<FavoriteTorrent[]>('favorites', () => [])
  const ready = useState('favorites-ready', () => false)
  const storageError = useState('favorites-error', () => '')

  function readStored() {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw === null ? [] : parseFavorites(raw)
  }

  function hydrate() {
    try {
      favorites.value = readStored()
      storageError.value = ''
    } catch {
      storageError.value = '无法读取本地收藏，请检查浏览器存储权限或备份数据'
    } finally {
      ready.value = true
    }
  }

  // 先读取其他标签页的最新数据；写入成功后才更新界面，避免配额失败时显示已保存。
  function commit(update: (current: FavoriteTorrent[]) => FavoriteTorrent[]) {
    try {
      const current = readStored()
      const next = update(current)
      localStorage.setItem(FAVORITES_KEY, serializeFavorites(next))
      favorites.value = next
      storageError.value = ''
      return true
    } catch (error) {
      storageError.value = '收藏未保存，请检查浏览器存储空间和权限'
      pushToast('err', storageError.value, errorMessage(error))
      return false
    }
  }

  const hashes = computed(() => new Set(favorites.value.map((item) => item.infoHash)))
  function isFavorite(hash: string) { return hashes.value.has(hash.toLowerCase()) }

  function toggle(torrent: TorrentView) {
    let removed = false
    const ok = commit((current) => {
      const item = toFavorite(torrent)
      removed = current.some((entry) => entry.infoHash === item.infoHash)
      return removed ? current.filter((entry) => entry.infoHash !== item.infoHash) : [item, ...current]
    })
    if (ok) pushToast('ok', removed ? '已取消收藏' : '已加入收藏夹')
  }

  function importBackup(raw: string): number | null {
    const incoming = parseFavorites(raw)
    let count = 0
    const ok = commit((current) => {
      const merged = mergeFavorites(current, incoming)
      count = merged.length - current.length
      return merged
    })
    return ok ? count : null
  }

  function removeMany(infoHashes: string[]) {
    const selected = new Set(infoHashes.map((hash) => hash.toLowerCase()))
    let count = 0
    const ok = commit((current) => {
      const next = current.filter((item) => !selected.has(item.infoHash))
      count = current.length - next.length
      return next
    })
    if (ok) pushToast('ok', translateText('已取消 {count} 条收藏').replace('{count}', String(count)))
    return ok
  }

  return { favorites: shallowReadonly(favorites), ready: readonly(ready), storageError: readonly(storageError), hydrate, isFavorite, toggle, importBackup, removeMany }
}
