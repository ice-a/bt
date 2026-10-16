// 浏览器端 WebTorrent（WebRTC）：把 P2P 流量放到用户自己的设备，
// 绕开 Vercel / Cloudflare 等 Serverless 不支持 UDP/DHT 的限制。
// 服务端仍保留非 P2P 的缓存服务兜底；这里是真正的 P2P 取数据路径。

// 浏览器只支持 WebRTC 节点，需要走 wss:// 的 tracker 才能发现对端
const WS_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev'
]

function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

function withWsTrackers(magnet: string): string {
  const existing = new Set<string>()
  for (const m of magnet.matchAll(/[?&]tr=([^&]+)/g)) {
    try {
      existing.add(decodeURIComponent(m[1]))
    } catch {
      /* ignore */
    }
  }
  const add = WS_TRACKERS.filter((t) => !existing.has(t))
  if (!add.length) return magnet
  const sep = magnet.includes('?') ? '&' : '?'
  return magnet + sep + add.map((t) => `tr=${encodeURIComponent(t)}`).join('&')
}

// 浏览器端 WebTorrent 以 CDN 的 UMD 包形式按需加载（避免把 webtorrent 打进 Vite 客户端，
// 同时绕开 Vite 8 与 node-polyfills 的 peer 依赖冲突）。优先 jsDelivr，失败再试 unpkg。
const WT_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/webtorrent@3.0.21/dist/webtorrent.min.js',
  'https://unpkg.com/webtorrent@3.0.21/dist/webtorrent.min.js'
]

let wtPromise: Promise<any> | null = null
function loadWebTorrent(): Promise<any> {
  if (!wtPromise) {
    wtPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('WebTorrent 只能在浏览器中运行'))
        return
      }
      const existing = (window as any).WebTorrent
      if (existing) {
        resolve(existing)
        return
      }
      const tryLoad = (i: number) => {
        if (i >= WT_CDN_URLS.length) {
          reject(new Error('无法从 CDN 加载 WebTorrent（可能被网络或 CSP 拦截）'))
          return
        }
        const script = document.createElement('script')
        script.src = WT_CDN_URLS[i]
        script.async = true
        script.onload = () => {
          const WT = (window as any).WebTorrent
          if (WT) resolve(WT)
          else tryLoad(i + 1)
        }
        script.onerror = () => tryLoad(i + 1)
        document.head.appendChild(script)
      }
      tryLoad(0)
    })
  }
  return wtPromise
}

// 当前活跃的浏览器 P2P 会话数，用于顶栏指示
import { ref } from 'vue'
export const p2pActive = ref(false)
let activeSessions = 0
function enterSession() {
  activeSessions++
  p2pActive.value = activeSessions > 0
}
function leaveSession() {
  activeSessions = Math.max(0, activeSessions - 1)
  p2pActive.value = activeSessions > 0
}

function waitForMetadata(torrent: any, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (torrent.metadata || torrent.ready) return resolve()
    const timer = setTimeout(
      () => reject(new Error('浏览器 P2P 获取元数据超时，可能该种子没有 WebRTC 节点')),
      timeoutMs
    )
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    torrent.on('metadata', done)
    torrent.on('ready', done)
    torrent.on('error', (e: Error) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

export interface ResolveProgress {
  phase: 'connecting' | 'metadata' | 'done'
  peers: number
  message: string
}

export interface FileProgress {
  progress: number
  peers: number
  downloaded: number
  length: number
  message: string
}

export async function resolveMetadataClient(
  magnet: string,
  opts: { timeoutMs?: number; onProgress?: (p: ResolveProgress) => void } = {}
): Promise<{ name: string; files: { path: string; length: number }[]; size: number }> {
  const onProgress = opts.onProgress
  const timeoutMs = opts.timeoutMs ?? 30000
  const WebTorrent = await loadWebTorrent()
  const client = new WebTorrent()
  enterSession()
  try {
    const torrent = client.add(withWsTrackers(magnet))
    const report = (phase: ResolveProgress['phase'], message?: string) => {
      const peers = torrent.numPeers ?? 0
      onProgress?.({
        phase,
        peers,
        message:
          message ??
          (peers > 0 ? `已连接 ${peers} 个节点，正在获取元数据…` : '正在通过 WebRTC 寻找 P2P 节点…')
      })
    }
    torrent.on('wire', () => report('connecting'))
    torrent.on('metadata', () => report('metadata', '已拿到元数据，正在整理文件清单…'))
    await waitForMetadata(torrent, timeoutMs)
    report('metadata', '已拿到元数据，正在整理文件清单…')
    const files = (torrent.files || []).map((f: any) => ({
      path: normPath(String(f.path || f.name || '')),
      length: Number(f.length) || 0
    }))
    if (!files.length) throw new Error('已连上节点，但对方没有返回任何文件信息')
    onProgress?.({ phase: 'done', peers: torrent.numPeers ?? 0, message: `共 ${files.length} 个文件` })
    return { name: String(torrent.name || ''), files, size: files.reduce((s, f) => s + f.length, 0) }
  } finally {
    leaveSession()
    try {
      client.destroy()
    } catch {
      /* ignore */
    }
  }
}

export async function readFileBytesClient(
  magnet: string,
  filePath: string,
  opts: { timeoutMs?: number; onProgress?: (p: FileProgress) => void } = {}
): Promise<ArrayBuffer> {
  const onProgress = opts.onProgress
  const timeoutMs = opts.timeoutMs ?? 25000
  const WebTorrent = await loadWebTorrent()
  const client = new WebTorrent()
  enterSession()
  try {
    const torrent = client.add(withWsTrackers(magnet))
    await waitForMetadata(torrent, timeoutMs)
    const target = (torrent.files || []).find(
      (f: any) => normPath(String(f.path || f.name || '')) === normPath(filePath)
    )
    if (!target) throw new Error('这个种子里没有该文件，文件清单可能已过期')

    const report = () => {
      const peers = torrent.numPeers ?? 0
      const progress = Number(target.progress) || 0
      onProgress?.({
        progress,
        peers,
        downloaded: Number(target.downloaded) || 0,
        length: Number(target.length) || 0,
        message:
          peers > 0 ? `下载中 ${Math.round(progress * 100)}% · ${peers} 个节点` : '正在连接 P2P 节点…'
      })
    }
    torrent.on('wire', report)
    if (typeof target.on === 'function') target.on('download', report)
    report()
    const ab = await target.arrayBuffer()
    onProgress?.({
      progress: 1,
      peers: torrent.numPeers ?? 0,
      downloaded: Number(target.length) || 0,
      length: Number(target.length) || 0,
      message: '完成'
    })
    return ab
  } finally {
    leaveSession()
    try {
      client.destroy()
    } catch {
      /* ignore */
    }
  }
}

export async function isClientWebTorrentAvailable(): Promise<boolean> {
  try {
    await loadWebTorrent()
    return true
  } catch {
    return false
  }
}
