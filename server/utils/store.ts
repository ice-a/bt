import { downloadsCol, searchesCol, torrentsCol } from './mongo'
import type { SearchResult } from './search/types'
import type { TorrentInfo } from './torrent'
import type { DownloadDoc, SearchDoc, TorrentDoc } from './types'

function trackersFromMagnet(magnet: string): string[] {
  const out: string[] = []
  const re = /[?&]tr=([^&]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(magnet))) {
    try {
      out.push(decodeURIComponent(m[1]))
    } catch {
      out.push(m[1])
    }
  }
  return out
}

/** 只保留不在 $set 里出现过的字段，避免 MongoDB 报「字段冲突」 */
function insertOnly(candidates: Record<string, unknown>, set: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(candidates)) {
    if (!(key in set)) out[key] = value
  }
  return out
}

export async function recordSearch(doc: Omit<SearchDoc, 'createdAt'>) {
  const col = await searchesCol()
  await col.insertOne({ ...doc, createdAt: new Date() })
}

/** 把搜索结果写入 torrents 集合（infoHash 唯一，重复搜索只更新易变字段） */
export async function upsertSearchResults(results: SearchResult[]) {
  if (!results.length) return
  const col = await torrentsCol()
  const now = new Date()
  await col.bulkWrite(
    results.map((r) => {
      const set: Record<string, unknown> = {
        name: r.name,
        size: r.size,
        magnet: r.magnet,
        trackers: trackersFromMagnet(r.magnet),
        source: r.source,
        sourceId: r.sourceId,
        sourceUrl: r.sourceUrl,
        category: r.category,
        seeders: r.seeders,
        leechers: r.leechers,
        updatedAt: now
      }
      return {
        updateOne: {
          filter: { infoHash: r.infoHash },
          update: {
            $set: set,
            $setOnInsert: {
              infoHash: r.infoHash,
              createdAt: now,
              ...insertOnly(
                {
                  files: null,
                  fileCount: r.fileCount ?? null,
                  fileBase64: null,
                  comment: null,
                  creationDate: null,
                  resolvedAt: null,
                  resolveError: null
                },
                set
              )
            }
          },
          upsert: true
        }
      }
    }),
    { ordered: false }
  )
}

/** 把解析出来的种子信息写入 torrents 集合 */
export async function upsertParsedTorrent(
  info: TorrentInfo,
  extra: { fileBase64?: string | null; originalName?: string | null; source?: string } = {}
) {
  const col = await torrentsCol()
  const now = new Date()
  const set: Record<string, unknown> = {
    name: info.name,
    size: info.size,
    magnet: info.magnet,
    trackers: info.trackers,
    comment: info.comment,
    creationDate: info.creationDate,
    updatedAt: now
  }
  if (info.files) {
    set.files = info.files
    set.fileCount = info.files.length
    set.resolvedAt = now
    set.resolveError = null
  }
  if (extra.fileBase64) set.fileBase64 = extra.fileBase64

  await col.updateOne(
    { infoHash: info.infoHash },
    {
      $set: set,
      $setOnInsert: {
        infoHash: info.infoHash,
        createdAt: now,
        source: extra.source || 'upload',
        sourceId: null,
        sourceUrl: null,
        category: null,
        seeders: null,
        leechers: null,
        ...insertOnly(
          { files: null, fileCount: info.fileCount ?? null, fileBase64: null, resolvedAt: null, resolveError: null },
          set
        )
      }
    },
    { upsert: true }
  )
}

export async function getTorrent(infoHash: string): Promise<TorrentDoc | null> {
  const col = await torrentsCol()
  return await col.findOne({ infoHash })
}

export async function markResolved(
  infoHash: string,
  data: { files: TorrentDoc['files']; size: number; name?: string } | null,
  error: string | null
) {
  const col = await torrentsCol()
  const now = new Date()
  const update: Record<string, unknown> = { resolveError: error, updatedAt: now }
  if (data) {
    update.files = data.files
    update.fileCount = data.files ? data.files.length : null
    update.size = data.size
    update.resolvedAt = now
    if (data.name) update.name = data.name
  }
  await col.updateOne({ infoHash }, { $set: update })
}

export async function recordDownload(doc: Omit<DownloadDoc, 'createdAt'>) {
  const col = await downloadsCol()
  await col.insertOne({ ...doc, createdAt: new Date() })
}
