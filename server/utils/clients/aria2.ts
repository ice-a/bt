import { baseUrlOf, type BtClientConfig } from '../appconfig'
import { httpFetch } from '../http'
import type { AddTaskInput, AddTaskResult, BtClientAdapter, ProbeResult } from './types'

function rpcUrl(cfg: BtClientConfig) {
  const path = cfg.path && cfg.path.trim() ? cfg.path.trim() : '/jsonrpc'
  return `${baseUrlOf(cfg)}${path.startsWith('/') ? path : `/${path}`}`
}

function headersOf(cfg: BtClientConfig) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cfg.username) {
    headers.authorization = `Basic ${Buffer.from(`${cfg.username}:${cfg.password || ''}`).toString('base64')}`
  }
  return headers
}

/** aria2 的 RPC 密钥以 token:xxx 形式作为第一个参数传入 */
async function call(cfg: BtClientConfig, method: string, params: unknown[]) {
  const secret = (cfg.password || '').trim()
  const payload = {
    jsonrpc: '2.0',
    id: `dsl-${Date.now().toString(36)}`,
    method,
    params: secret ? [`token:${secret}`, ...params] : params
  }
  const res = await httpFetch(rpcUrl(cfg), {
    method: 'POST',
    timeoutMs: 10000,
    headers: headersOf(cfg),
    body: JSON.stringify(payload)
  })
  if (res.status === 401) throw new Error('aria2 认证失败，请检查 --rpc-user / --rpc-pass')
  if (!res.ok) throw new Error(`aria2 返回 HTTP ${res.status}`)

  const data = (await res.json()) as { result?: unknown; error?: { code: number; message: string } }
  if (data.error) throw new Error(`aria2 错误 ${data.error.code}：${data.error.message}`)
  return data.result
}

export const aria2Adapter: BtClientAdapter = {
  type: 'aria2',
  label: 'aria2',
  defaultPort: 6800,
  defaultPath: '/jsonrpc',

  async probe(cfg: BtClientConfig): Promise<ProbeResult> {
    const result = (await call(cfg, 'aria2.getVersion', [])) as { version?: string } | undefined
    return { online: true, version: result?.version }
  },

  async add(cfg: BtClientConfig, input: AddTaskInput): Promise<AddTaskResult> {
    if (!input.magnet && !input.torrentBase64) throw new Error('缺少磁力链或种子文件内容')
    const dir = input.downloadDir || cfg.downloadDir
    const options: Record<string, unknown> = {}
    if (dir) options.dir = dir
    // 磁力链需要先下载元数据，开启种子相关选项以便更好识别
    options['bt-metadata-only'] = 'false'

    const gid = input.magnet
      ? await call(cfg, 'aria2.addUri', [[input.magnet], options])
      : await call(cfg, 'aria2.addTorrent', [input.torrentBase64, [], options])

    return { ok: true, message: `已提交到 aria2（gid: ${String(gid)}）`, detail: gid }
  },

  async getTasks(cfg: BtClientConfig): Promise<BtTask[]> {
    // 获取正在下载、等待中、已停止的任务
    const [active, waiting, stopped] = (await Promise.all([
      call(cfg, 'aria2.tellActive', []),
      call(cfg, 'aria2.tellWaiting', [0, 100]),
      call(cfg, 'aria2.tellStopped', [0, 100])
    ])) as any[][]

    const all = [...active, ...waiting, ...stopped]

    return all.map((t) => {
      const size = Number(t.totalLength) || 0
      const downloaded = Number(t.completedLength) || 0
      // aria2 的 infoHash 存在 bittorrent.info.hash
      const infoHash = t.bittorrent?.info?.hash || t.infoHash || ''

      return {
        infoHash,
        name: t.bittorrent?.info?.name || t.files?.[0]?.path || 'aria2-task',
        progress: size > 0 ? downloaded / size : 0,
        size,
        downloaded,
        uploaded: Number(t.uploadLength) || 0,
        dlspeed: Number(t.downloadSpeed) || 0,
        upspeed: Number(t.uploadSpeed) || 0,
        status: mapAria2Status(t.status),
        eta: calculateEta(size, downloaded, Number(t.downloadSpeed))
      }
    })
  }
}

function mapAria2Status(status: string): BtTask['status'] {
  switch (status) {
    case 'active': return 'downloading'
    case 'waiting': return 'queued'
    case 'paused': return 'paused'
    case 'error': return 'error'
    case 'complete': return 'completed'
    case 'removed': return 'unknown'
    default: return 'unknown'
  }
}

function calculateEta(total: number, current: number, speed: number): number | undefined {
  if (speed <= 0 || total <= current) return undefined
  return Math.floor((total - current) / speed)
}
