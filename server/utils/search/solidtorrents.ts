import { DEFAULT_TRACKERS } from '../torrent'
import { DEFAULT_UA, httpJson } from '../http'
import type { ProviderContext, SearchProvider, SearchResult } from './types'

export const solidtorrentsProvider: SearchProvider = {
  id: 'solidtorrents',
  label: 'SolidTorrents',
  homepage: 'https://solidtorrents.net',

  async search(query: string, ctx: ProviderContext): Promise<SearchResult[]> {
    const url = `https://solidtorrents.net/api/v1/search?q=${encodeURIComponent(query)}&category=all&sort=seeders`
    const raw = await httpJson<any>(url, {
      proxy: ctx.proxy,
      timeoutMs: ctx.timeoutMs,
      headers: { accept: 'application/json', 'user-agent': DEFAULT_UA }
    })

    if (!raw || !Array.isArray(raw.results)) return []

    return raw.results.map((it: any) => {
      const infoHash = String(it.infohash).toLowerCase()
      const name = String(it.title || infoHash)
      return {
        infoHash,
        name,
        size: Number(it.size) || 0,
        seeders: Number(it.swarm?.seeders) || 0,
        leechers: Number(it.swarm?.leechers) || 0,
        fileCount: null, // API doesn't seem to provide this in search list
        category: it.category || null,
        source: 'solidtorrents',
        sourceLabel: 'SolidTorrents',
        sourceId: null,
        sourceUrl: `https://solidtorrents.to/view/${infoHash}`,
        addedAt: it.createdAt ? new Date(it.createdAt) : null,
        magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}${DEFAULT_TRACKERS.map(
          (t) => `&tr=${encodeURIComponent(t)}`
        ).join('')}`
      } satisfies SearchResult
    })
  }
}
