import { MongoClient, type Collection, type Db } from 'mongodb'
import type { DownloadDoc, SearchDoc, TorrentDoc } from './types'

let client: MongoClient | null = null
let connecting: Promise<MongoClient> | null = null
let indexState: 'pending' | 'done' = 'pending'

export const mongoUri = () => process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
export const mongoDbName = () => process.env.MONGODB_DB || 'torrent_console'

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
        return cli
      })
      .catch((err: unknown) => {
        connecting = null
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

/** 供 /api/health 使用：探测 MongoDB 是否可用（只返回 ok，不暴露任何连接信息） */
export async function mongoStatus() {
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    return { ok: true }
  } catch {
    return { ok: false }
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
