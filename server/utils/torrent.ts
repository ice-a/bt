import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import parseTorrent, { toMagnetURI } from 'parse-torrent'
import type { TorrentFileEntry } from './types'

export interface TorrentInfo {
  infoHash: string
  name: string
  size: number
  files: TorrentFileEntry[] | null
  fileCount: number | null
  trackers: string[]
  magnet: string
  comment: string | null
  creationDate: Date | null
  pieceLength: number | null
  isPrivate: boolean
}

export const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce'
]

export function buildMagnet(infoHash: string, name?: string | null, trackers: string[] = DEFAULT_TRACKERS): string {
  const params = [`xt=urn:btih:${infoHash}`]
  if (name) params.push(`dn=${encodeURIComponent(name)}`)
  for (const tr of trackers) params.push(`tr=${encodeURIComponent(tr)}`)
  return `magnet:?${params.join('&')}`
}

/** 从磁力链里取出已有的 tracker */
function trackersInMagnet(magnet: string): string[] {
  const out = new Set<string>()
  for (const m of magnet.matchAll(/[?&]tr=([^&]+)/g)) {
    try {
      out.add(decodeURIComponent(m[1]))
    } catch {
      /* 编码坏了就跳过 */
    }
  }
  return [...out]
}

/**
 * 给没有 tracker 的磁力链补上 tracker。
 * 社区里流传的裸磁力链（只有 xt + dn）常常一个 tracker 都没有，
 * 纯靠 DHT 在家庭网络/被墙环境里几乎拉不到元数据，补公共 tracker 能显著提高成功率。
 */
export function withDefaultTrackers(magnet: string, extra: string[] = []): string {
  if (!magnet || /[?&]tr=/.test(magnet)) return magnet
  const list = extra.length ? extra : DEFAULT_TRACKERS
  return magnet + list.map((t) => `&tr=${encodeURIComponent(t)}`).join('')
}

/** 仅 HTTP/HTTPS/WebSocket 的 tracker（不走 UDP/DHT，Serverless 环境也能出网） */
export const HTTP_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'http://tracker.opentrackr.org/announce',
  'http://open.acgnloader.live:8484/announce',
  'https://tracker.nanocodes.net/announce'
]

/** 给磁力链补上 HTTP/WS tracker（不补 UDP，避免 DHT） */
export function withHttpTrackers(magnet: string): string {
  const existing = new Set(trackersInMagnet(magnet))
  const add = HTTP_TRACKERS.filter((t) => !existing.has(t))
  if (!add.length) return magnet
  const sep = magnet.includes('?') ? '&' : '?'
  return magnet + sep + add.map((t) => `tr=${encodeURIComponent(t)}`).join('&')
}

function toInfoHash(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value.toLowerCase()
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return Buffer.from(value as Uint8Array).toString('hex')
  return String(value).toLowerCase()
}

function pickTrackers(parsed: Record<string, unknown>): string[] {
  const out = new Set<string>()
  const announce = parsed.announce
  if (typeof announce === 'string') out.add(announce)
  else if (Array.isArray(announce)) for (const a of announce) if (typeof a === 'string') out.add(a)
  const list = parsed.announceList
  if (Array.isArray(list)) {
    for (const tier of list) {
      if (Array.isArray(tier)) for (const a of tier) if (typeof a === 'string') out.add(a)
    }
  }
  return [...out]
}

function normalize(parsed: Record<string, any>, magnetFallback?: string): TorrentInfo {
  const infoHash = toInfoHash(parsed.infoHash)
  let files: TorrentFileEntry[] | null = null
  if (Array.isArray(parsed.files) && parsed.files.length) {
    files = parsed.files.map((f: any) => ({
      // parse-torrent 用 path.sep 拼接，Windows 下是反斜杠，统一成正斜杠便于展示
      path: String(f.path ?? f.name ?? '').replace(/\\/g, '/'),
      length: Number(f.length) || 0
    }))
  } else if (typeof parsed.length === 'number') {
    // 单文件种子：parse-torrent 只给出 length + name
    files = [{ path: String(parsed.name || 'unknown'), length: Number(parsed.length) || 0 }]
  }

  const size = files ? files.reduce((sum, f) => sum + (f.length || 0), 0) : Number(parsed.length) || 0
  let trackers = pickTrackers(parsed)

  let magnet = magnetFallback || ''
  if (!magnet) {
    try {
      magnet = toMagnetURI(parsed as never)
    } catch {
      magnet = infoHash ? buildMagnet(infoHash, parsed.name, trackers.length ? trackers : DEFAULT_TRACKERS) : ''
    }
  }
  magnet = withDefaultTrackers(magnet, trackers)
  // 补过 tracker 的磁力链，trackers 以最终磁力链为准，避免 UI 显示“无 tracker”
  if (!trackers.length) trackers = trackersInMagnet(magnet)

  return {
    infoHash,
    name: String(parsed.name || ''),
    size,
    files,
    fileCount: files ? files.length : null,
    trackers,
    magnet,
    comment: typeof parsed.comment === 'string' ? parsed.comment : null,
    creationDate: parsed.created instanceof Date
      ? parsed.created
      : parsed.creationDate instanceof Date
        ? parsed.creationDate
        : null,
    pieceLength: typeof parsed.pieceLength === 'number' ? parsed.pieceLength : null,
    isPrivate: parsed.private === true
  }
}

/** 解析 .torrent 文件内容（parse-torrent v11 起为异步 API） */
export async function parseTorrentBuffer(buf: Buffer): Promise<TorrentInfo> {
  let parsed: any
  try {
    parsed = await parseTorrent(buf)
  } catch {
    throw new Error('种子文件解析失败，可能不是合法的 .torrent 文件')
  }
  const info = normalize(parsed)
  if (!info.infoHash) throw new Error('种子文件中缺少 info 字段，无法计算 infoHash')
  return info
}

/** 解析磁力链（不含文件清单，需要通过 fetchMetadataFromMagnet 才能拿到） */
export async function parseMagnet(uri: string): Promise<TorrentInfo> {
  const raw = uri.trim()
  if (!/^magnet:\?/i.test(raw)) throw new Error('不是合法的磁力链接，应以 magnet:? 开头')
  if (!/xt=urn:btih:[a-z0-9]+/i.test(raw)) throw new Error('磁力链接中缺少 xt=urn:btih: 参数')
  let parsed: any
  try {
    parsed = await parseTorrent(raw)
  } catch {
    throw new Error('磁力链接解析失败')
  }
  const info = normalize(parsed, raw)
  if (!info.infoHash) throw new Error('无法从磁力链接中提取 infoHash')
  return info
}

/** 判断字符串是否为磁力链 */
export function isMagnet(input: string): boolean {
  return /^magnet:\?/i.test(input.trim())
}

let webTorrentMod: unknown = null

export async function loadWebTorrent(): Promise<any> {
  if (webTorrentMod) return webTorrentMod
  try {
    const mod: any = await import('webtorrent')
    webTorrentMod = mod?.default || mod
    return webTorrentMod
  } catch {
    throw new Error('无法在当前运行环境加载 webtorrent（需要支持 UDP 的 Node 运行时；Vercel / 其他 Serverless 通常不可用），仅能显示 infoHash')
  }
}

export function hasWebTorrent(): boolean {
  return webTorrentMod !== null
}

/** 探测 webtorrent 依赖是否可用（用于健康检查与 UI 提示） */
export async function checkWebTorrent(): Promise<boolean> {
  try {
    await loadWebTorrent()
    return true
  } catch {
    return false
  }
}

function extractInfoHash(magnet: string): string {
  const m = magnet.match(/xt=urn:btih:([a-z0-9]+)/i)
  return m ? m[1].toLowerCase() : ''
}

/** 通过公开的 torrent 缓存服务取 .torrent（纯 HTTPS，无需 P2P，Vercel 等 Serverless 可用） */
const TORRENT_CACHES: ((ih: string) => string)[] = [
  (ih) => `https://itorrents.org/torrent/${ih}.torrent`,
  (ih) => `https://torcache.net/torrent/${ih}.torrent`,
  (ih) => `https://thetorrent.org/${ih}`,
  (ih) => `https://btcache.me/torrent/${ih}/download`
]

async function fetchFromCache(infoHash: string): Promise<{ name: string; files: TorrentFileEntry[]; size: number } | null> {
  if (!infoHash) return null
  const results = await Promise.allSettled(
    TORRENT_CACHES.map(async (fn) => {
      const res = await fetch(fn(infoHash), { redirect: 'follow', signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const info = await parseTorrentBuffer(buf)
      if (!info.files?.length) throw new Error('no files')
      return { name: info.name, files: info.files, size: info.size }
    })
  )
  for (const r of results) if (r.status === 'fulfilled') return r.value
  return null
}

/**
 * 在线获取种子元数据（文件清单）。
 * 优先走 torrent 缓存服务（纯 HTTPS，Vercel 等 Serverless 可用，无需 P2P）；
 * 缓存未命中时再尝试 webtorrent，但关闭 DHT、仅用 http/wss tracker（需支持 TCP/TLS 的 Node 运行时）。
 */
export async function fetchMetadataFromMagnet(
  magnetUri: string,
  timeoutMs = 30000
): Promise<{ name: string; files: TorrentFileEntry[]; size: number }> {
  const infoHash = extractInfoHash(magnetUri)

  // 1) torrent 缓存服务（并发尝试，取第一个成功）
  const cached = await fetchFromCache(infoHash)
  if (cached) return cached

  // 2) webtorrent：关闭 DHT，仅 http/wss tracker
  try {
    const WebTorrent = await loadWebTorrent()
    const dir = join(tmpdir(), `dsl-meta-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
    await mkdir(dir, { recursive: true })
    const client = new WebTorrent({ dht: false, lsd: false, utp: false })
    try {
      const torrent = client.add(withHttpTrackers(magnetUri), { path: dir })
      torrent.on('warning', () => {})
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`获取种子元数据超时（${Math.round(timeoutMs / 1000)}s），可能缺少可用的 HTTP/WS tracker`))
        }, timeoutMs)
        const done = (fn: () => void) => {
          clearTimeout(timer)
          fn()
        }
        if (torrent.metadata) return done(resolve)
        torrent.on('metadata', () => done(resolve))
        torrent.on('error', (err: Error) => done(() => reject(err)))
        client.on('error', (err: Error) => done(() => reject(err)))
      })
      const files: TorrentFileEntry[] = (torrent.files || []).map((f: any) => ({
        path: String(f.path || f.name || '').replace(/\\/g, '/'),
        length: Number(f.length) || 0
      }))
      return { name: String(torrent.name || ''), files, size: files.reduce((sum, f) => sum + f.length, 0) }
    } finally {
      try {
        await new Promise<void>((resolve) => client.destroy(() => resolve()))
      } catch {
        /* ignore */
      }
      rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  } catch {
    // webtorrent 在当前环境不可用（例如 Vercel 无法加载原生模块），忽略，继续降级
  }

  throw new Error('无法通过在线方式获取种子元数据：缓存服务未命中，且当前环境不支持 webtorrent（DHT 已禁用，仅 HTTP/WS tracker）。仅显示 infoHash')
}
