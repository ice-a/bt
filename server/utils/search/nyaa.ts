import { XMLParser } from 'fast-xml-parser'
import { DEFAULT_TRACKERS } from '../torrent'
import { DEFAULT_UA, httpText } from '../http'
import type { ProviderContext, SearchProvider, SearchResult } from './types'

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  tb: 1024 ** 4,
  tib: 1024 ** 4
}

/** "1.23 GiB" / "456 MB" → 字节数 */
function parseSize(input: unknown): number {
  if (typeof input === 'number') return input
  const text = String(input || '').trim()
  const m = text.match(/^([\d.]+)\s*([a-zA-Z]+)?$/)
  if (!m) return 0
  const value = Number(m[1]) || 0
  const unit = (m[2] || 'b').toLowerCase()
  return Math.round(value * (SIZE_UNITS[unit] ?? 1))
}

function nyaaBase() {
  return (process.env.NYAA_BASE || 'https://nyaa.si').replace(/\/+$/, '')
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function pickString(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['#text'] ?? '')
  }
  return String(value)
}

export const nyaaProvider: SearchProvider = {
  id: 'nyaa',
  label: 'Nyaa',
  homepage: 'https://nyaa.si',

  async search(query: string, ctx: ProviderContext): Promise<SearchResult[]> {
    // c=0_0 全部分类；f=0 只过滤可信发布者之外的全部结果
    const url = `${nyaaBase()}/?page=rss&q=${encodeURIComponent(query)}&c=0_0&f=0`
    const xml = await httpText(url, {
      proxy: ctx.proxy,
      timeoutMs: ctx.timeoutMs,
      headers: { accept: 'application/rss+xml, application/xml, text/xml', 'user-agent': DEFAULT_UA }
    })

    const parser = new XMLParser({ removeNSPrefix: true, trimValues: true, parseTagValue: false })
    const doc = parser.parse(xml) as Record<string, any>
    const items = asArray(doc?.rss?.channel?.item)

    return items
      .map((item: Record<string, any>) => {
        const infoHash = pickString(item.infoHash).toLowerCase()
        if (!/^[a-f0-9]{40}$/.test(infoHash)) return null
        const name = pickString(item.title) || infoHash
        const torrentUrl = pickString(item.guid) || pickString(item.link)
        const category = pickString(item.category)
        const pubDate = pickString(item.pubDate)
        const added = pubDate ? new Date(pubDate) : null

        return {
          infoHash,
          name,
          size: parseSize(item.size),
          seeders: Number(pickString(item.seeders)) || 0,
          leechers: Number(pickString(item.leechers)) || 0,
          fileCount: null,
          category: category || null,
          source: 'nyaa',
          sourceLabel: 'Nyaa',
          sourceId: pickString(item.link) || null,
          sourceUrl: torrentUrl || null,
          addedAt: added && !Number.isNaN(added.getTime()) ? added : null,
          magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}${DEFAULT_TRACKERS.map(
            (t) => `&tr=${encodeURIComponent(t)}`
          ).join('')}`
        } satisfies SearchResult
      })
      .filter((item): item is SearchResult => item !== null)
  }
}
