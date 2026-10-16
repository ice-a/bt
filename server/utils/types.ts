/** 数据库文档结构定义（服务端内部使用） */

export interface TorrentFileEntry {
  path: string
  length: number
}

/** torrents 集合：种子元信息 + 解析结果缓存，infoHash 唯一 */
export interface TorrentDoc {
  infoHash: string
  name: string
  size: number
  files: TorrentFileEntry[] | null
  fileCount: number | null
  trackers: string[]
  magnet: string
  source: string
  sourceId: string | null
  sourceUrl: string | null
  category: string | null
  seeders: number | null
  leechers: number | null
  comment: string | null
  creationDate: Date | null
  /** 用户上传的原始 .torrent 内容（base64，仅 <= 1MB 时保存） */
  fileBase64: string | null
  resolvedAt: Date | null
  resolveError: string | null
  createdAt: Date
  updatedAt: Date
}

/** searches 集合：用户搜索记录 */
export interface SearchDoc {
  keyword: string
  providers: string[]
  resultCount: number
  durationMs: number
  ok: boolean
  error: string | null
  createdAt: Date
}

/** downloads 集合：投递到本机 BT 客户端的记录 */
export interface DownloadDoc {
  infoHash: string | null
  name: string
  clientId: string
  clientType: string
  clientName: string
  downloadDir: string | null
  ok: boolean
  message: string
  createdAt: Date
}
