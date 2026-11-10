import type { Collection, Db, MongoClient } from 'mongodb'
import type { SearchDoc, TorrentDoc } from './types'

// mongodb 是按需动态加载的：Cloudflare Workers 等非 Node 环境没有 TCP，也不提供该包，
// 一旦尝试连接必然失败；这里做成懒加载 + 失败缓存，避免每次请求都卡 10 秒去连库。
let client: MongoClient | null = null
let connecting: Promise<MongoClient> | null = null
let unavailableUntil = 0
let indexState: 'pending' | 'done' = 'pending'

export const mongoUri = () => process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
export const mongoDbName = () => process.env.MONGODB_DB || 'torrent_console'

export async function getClient(): Promise<MongoClient> {
  if (client) return client
  if (Date.now() < unavailableUntil) {
    throw new Error('MongoDB 当前不可用（已缓存失败状态，稍后重试）')
  }
  if (!connecting) {
    connecting = (async () => {
      const { MongoClient } = await import('mongodb')
      const next = new MongoClient(mongoUri(), {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 30000,
        retryWrites: true
      })
      try {
        const cli = await next.connect()
        client = cli
        return cli
      } catch (err: unknown) {
        // 连接失败（如 Cloudflare 上无 TCP、或本地没起 MongoDB）：缓存一小段时间的失败状态，
        // 避免后续每个 DB 操作都重新尝试连接造成卡顿。
        unavailableUntil = Date.now() + 60_000
        next.close().catch(() => {})
        throw err
      } finally {
        connecting = null
      }
    })()
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
}

export async function torrentsCol(): Promise<Collection<TorrentDoc>> {
  return (await getDb()).collection<TorrentDoc>('torrents')
}

export async function searchesCol(): Promise<Collection<SearchDoc>> {
  return (await getDb()).collection<SearchDoc>('searches')
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
