export interface TorrentFileEntry {
  path: string
  length: number
}

export interface TorrentView {
  infoHash: string
  name: string
  size: number
  files: TorrentFileEntry[] | null
  fileCount: number | null
  trackers: string[]
  magnet: string
  source?: string
  sourceLabel?: string
  sourceUrl?: string | null
  category?: string | null
  seeders?: number | null
  leechers?: number | null
  comment?: string | null
  creationDate?: string | null
  resolvedAt?: string | null
  resolveError?: string | null
  /** 服务端是否保存了原始 .torrent 文件，可提供下载 */
  hasFile?: boolean
}

export interface SearchResult extends TorrentView {
  sourceLabel: string
}

export interface ProviderReport {
  id: string
  label: string
  ok: boolean
  count: number
  ms: number
  error: string | null
}

export interface SearchResponse {
  query: string
  durationMs: number
  results: SearchResult[]
  reports: ProviderReport[]
  stored: boolean
}

export interface HealthResponse {
  ok: boolean
  time: string
  mongo: { ok: boolean }
  webTorrent: boolean
  providers: { id: string; label: string; homepage: string }[]
  enabledProviders: string[]
  searchProxy: string
  authed: boolean
}
