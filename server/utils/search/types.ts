export interface SearchResult {
  infoHash: string
  name: string
  size: number
  seeders: number | null
  leechers: number | null
  fileCount: number | null
  category: string | null
  source: string
  sourceLabel: string
  sourceId: string | null
  sourceUrl: string | null
  addedAt: Date | null
  magnet: string
}

export interface ProviderContext {
  proxy: string | null
  timeoutMs: number
}

export interface SearchProvider {
  id: string
  label: string
  /** 该站点所在的站点根地址，便于 UI 上提示 */
  homepage: string
  search(query: string, ctx: ProviderContext): Promise<SearchResult[]>
}

export interface ProviderReport {
  id: string
  label: string
  ok: boolean
  count: number
  ms: number
  error: string | null
}
