import { MongoClient, type Collection, type Db } from 'mongodb'
import type { DownloadDoc, SearchDoc, TorrentDoc } from './types'

let client: MongoClient | null = null
let connecting: Promise<MongoClient> | null = null
let indexState: 'pending' | 'done' = 'pending'

export const mongoUri = () => process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
export const mongoDbName = () => process.env.MONGODB_DB || 'torrent_console'

/** 最近一次连接失败信息，用于在 UI 上提示用户去装 / 启 MongoDB */
let lastError: { message: string; at: Date } | null = null

export async function getClient(): Promise<MongoClient> {
  if (client) return client
  if (!connecting) {
    const next = new MongoClient(mongoUri(), {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 20000,
      socketTimeoutMS: 30000,
      retryWrites: true
    })
    connecting = next
      .connect()
      .then((cli) => {
        client = cli
        connecting = null
        lastError = null
        return cli
      })
      .catch((err: unknown) => {
        connecting = null
        lastError = { message: err instanceof Error ? err.message : String(err), at: new Date() }
        next.close().catch(() => {})
        throw err
      })
  }
  return connecting
}

export async function getDb(): Promise<Db> {
  const cli = await getClient()
  const db = cli.db(mongoDbName())
  if (indexState === 'pending') {
    await ensureIndexes(db)
    indexState = 'done'
  }
  return db
}

async function ensureIndexes(db: Db) {
  await db.collection<TorrentDoc>('torrents').createIndex({ infoHash: 1 }, { unique: true })
  await db.collection<TorrentDoc>('torrents').createIndex({ updatedAt: -1 })
  await db.collection<SearchDoc>('searches').createIndex({ createdAt: -1 })
  await db.collection<SearchDoc>('searches').createIndex({ keyword: 1 })
  await db.collection<DownloadDoc>('downloads').createIndex({ createdAt: -1 })
}

export async function torrentsCol(): Promise<Collection<TorrentDoc>> {
  return (await getDb()).collection<TorrentDoc>('torrents')
}

export async function searchesCol(): Promise<Collection<SearchDoc>> {
  return (await getDb()).collection<SearchDoc>('searches')
}

export async function downloadsCol(): Promise<Collection<DownloadDoc>> {
  return (await getDb()).collection<DownloadDoc>('downloads')
}

/** 把驱动错误里的连接串 / 主机名脱敏，避免泄露凭证与数据库地址 */
function sanitizeMongoError(raw: string): string {
  return raw
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, '***')
    .replace(/[a-z0-9.-]+\.mongodb\.net(?::\d+)?/gi, '***')
}

/** 供 /api/health 使用：探测 MongoDB 是否可用（不返回任何连接串 / 库名） */
export async function mongoStatus() {
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    return { ok: true, error: null as string | null }
  } catch (err) {
    return {
      ok: false,
      error: sanitizeMongoError(lastError?.message || (err instanceof Error ? err.message : String(err)))
    }
  }
}

/** MongoDB 不可用时的兜底：只记录日志，不打断主流程 */
export async function tryMongo<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.warn('[mongo] 操作失败，已跳过：', err instanceof Error ? err.message : err)
    return null
  }
}
