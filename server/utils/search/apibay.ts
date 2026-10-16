import { DEFAULT_TRACKERS } from '../torrent'
import { DEFAULT_UA, httpJson } from '../http'
import type { ProviderContext, SearchProvider, SearchResult } from './types'

/** The Pirate Bay 分类编号 → 可读标签（只保留常见项） */
const TPB_CATEGORIES: Record<string, string> = {
  '101': '音乐', '102': '有声书', '103': '视频', '104': '电影', '105': '剧集', '106': 'MV', '199': '其他',
  '201': '软件', '202': '安卓', '203': 'Mac', '204': '游戏', '205': 'PC游戏', '206': 'Mac游戏', '207': '其他',
  '301': '视频', '302': '视频', '303': '图片', '304': '其他', '399': '其他',
  '401': '游戏', '402': 'PC游戏', '403': 'Mac游戏', '404': '其他',
  '501': '其他', '502': '电子书', '503': '漫画', '504': '图片', '505': '其他', '599': '其他',
  '601': '其他', '602': '电子书', '603': '音频', '604': '视频', '605': '其他', '699': '其他'
}

function apibayBase() {
  return (process.env.APIBAY_BASE || 'https://apibay.org').replace(/\/+$/, '')
}

export const apibayProvider: SearchProvider = {
  id: 'apibay',
  label: 'The Pirate Bay',
  homepage: 'https://thepiratebay.org',

  async search(query: string, ctx: ProviderContext): Promise<SearchResult[]> {
    const url = `${apibayBase()}/q.php?q=${encodeURIComponent(query)}&cat=0`
    const raw = await httpJson<any[]>(url, {
      proxy: ctx.proxy,
      timeoutMs: ctx.timeoutMs,
      headers: { accept: 'application/json', 'user-agent': DEFAULT_UA }
    })
    if (!Array.isArray(raw)) return []

    return raw
      .filter((it) => {
        if (!it || typeof it.info_hash !== 'string') return false
        if (it.info_hash === '0000000000000000000000000000000000000000') return false
        if (typeof it.name === 'string' && /no results returned/i.test(it.name)) return false
        return true
      })
      .map((it) => {
        const infoHash = String(it.info_hash).toLowerCase()
        const name = String(it.name || infoHash)
        return {
          infoHash,
          name,
          size: Number(it.size) || 0,
          seeders: Number(it.seeders) || 0,
          leechers: Number(it.leechers) || 0,
          fileCount: Number(it.num_files) || null,
          category: TPB_CATEGORIES[String(it.category)] || (it.category ? `分类 ${it.category}` : null),
          source: 'apibay',
          sourceLabel: 'The Pirate Bay',
          sourceId: it.id ? String(it.id) : null,
          sourceUrl: it.id ? `https://thepiratebay.org/description.php?id=${it.id}` : null,
          addedAt: it.added ? new Date(Number(it.added) * 1000) : null,
          magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}${DEFAULT_TRACKERS.map(
            (t) => `&tr=${encodeURIComponent(t)}`
          ).join('')}`
        } satisfies SearchResult
      })
  }
}
