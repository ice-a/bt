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

let wtPromise: Promise<any> | null = null
function loadWebTorrent(): Promise<any> {
  if (!wtPromise) {
    // 仅在浏览器运行时按需加载，Vite 会将其单独拆包；服务端不会执行到此处
    wtPromise = import('webtorrent').then((m) => (m as any).default || m)
  }
  return wtPromise
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

export async function resolveMetadataClient(
  magnet: string,
  timeoutMs = 30000
): Promise<{ name: string; files: { path: string; length: number }[]; size: number }> {
  const WebTorrent = await loadWebTorrent()
  const client = new WebTorrent()
  try {
    const torrent = client.add(withWsTrackers(magnet))
    await waitForMetadata(torrent, timeoutMs)
    const files = (torrent.files || []).map((f: any) => ({
      path: normPath(String(f.path || f.name || '')),
      length: Number(f.length) || 0
    }))
    if (!files.length) throw new Error('已连上节点，但对方没有返回任何文件信息')
    return { name: String(torrent.name || ''), files, size: files.reduce((s, f) => s + f.length, 0) }
  } finally {
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
  timeoutMs = 25000
): Promise<ArrayBuffer> {
  const WebTorrent = await loadWebTorrent()
  const client = new WebTorrent()
  try {
    const torrent = client.add(withWsTrackers(magnet))
    await waitForMetadata(torrent, timeoutMs)
    const target = (torrent.files || []).find(
      (f: any) => normPath(String(f.path || f.name || '')) === normPath(filePath)
    )
    if (!target) throw new Error('这个种子里没有该文件，文件清单可能已过期')
    return await target.arrayBuffer()
  } finally {
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
