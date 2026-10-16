import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadWebTorrent, withDefaultTrackers } from './torrent'

/** 会话空闲多久后释放（毫秒） */
const IDLE_MS = 120_000

interface SwarmSession {
  client: any
  torrent: any
  dir: string
  ready: Promise<any>
  timer: NodeJS.Timeout | null
}

const sessions = new Map<string, SwarmSession>()

/**
 * 复用一个常驻的 webtorrent 会话来取文件内容。
 * 每张图片都重建一次客户端就得重新找一遍节点（快则 1 秒，慢则十几秒），
 * 所以同一个 infoHash 的连续预览共用一条会话，空闲 2 分钟自动释放。
 */
export async function withSwarm<T>(
  infoHash: string,
  magnet: string,
  timeoutMs: number,
  fn: (torrent: any) => Promise<T>
): Promise<T> {
  const key = infoHash.toLowerCase()
  let session = sessions.get(key)
  if (!session) {
    session = await createSession(key, magnet, timeoutMs)
    sessions.set(key, session)
  }
  touchSession(key, session)
  const torrent = await session.ready
  return fn(torrent)
}

function touchSession(key: string, session: SwarmSession) {
  if (session.timer) clearTimeout(session.timer)
  session.timer = setTimeout(() => releaseSession(key), IDLE_MS)
  session.timer.unref?.()
}

async function createSession(infoHash: string, magnet: string, timeoutMs: number): Promise<SwarmSession> {
  const WebTorrent = await loadWebTorrent()
  const dir = join(tmpdir(), `dsl-swarm-${infoHash.slice(0, 8)}-${Date.now().toString(36)}`)
  await mkdir(dir, { recursive: true })

  const client = new WebTorrent({ dht: true, lsd: false, utp: false })
  client.on('error', () => {})

  const torrent = client.add(withDefaultTrackers(magnet), { path: dir })
  torrent.on('warning', () => {})

  const ready = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`获取种子元数据超时（${Math.round(timeoutMs / 1000)}s），可能没有可用节点或 tracker 被墙`))
    }, timeoutMs)
    const done = (fn: () => void) => {
      clearTimeout(timer)
      fn()
    }
    if (torrent.metadata) return done(() => resolve(torrent))
    torrent.on('metadata', () => done(() => resolve(torrent)))
    torrent.on('error', (err: Error) => done(() => reject(err)))
    client.on('error', (err: Error) => done(() => reject(err)))
  })

  const session: SwarmSession = { client, torrent, dir, ready, timer: null }
  touchSession(infoHash, session)
  // 元数据都拿不到就别留着占资源
  ready.catch(() => releaseSession(infoHash))
  return session
}

function releaseSession(infoHash: string) {
  const session = sessions.get(infoHash)
  if (!session) return
  sessions.delete(infoHash)
  if (session.timer) clearTimeout(session.timer)
  try {
    session.client.destroy(() => {})
  } catch {
    /* ignore */
  }
  rm(session.dir, { recursive: true, force: true }).catch(() => {})
}
