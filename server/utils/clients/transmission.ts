import { baseUrlOf, type BtClientConfig } from '../appconfig'
import { httpFetch } from '../http'
import type { AddTaskInput, AddTaskResult, BtClientAdapter, ProbeResult } from './types'

function rpcUrl(cfg: BtClientConfig) {
  const path = cfg.path && cfg.path.trim() ? cfg.path.trim() : '/transmission/rpc'
  return `${baseUrlOf(cfg)}${path.startsWith('/') ? path : `/${path}`}`
}

function headersOf(cfg: BtClientConfig, sessionId?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cfg.username) {
    headers.authorization = `Basic ${Buffer.from(`${cfg.username}:${cfg.password || ''}`).toString('base64')}`
  }
  if (sessionId) headers['x-transmission-session-id'] = sessionId
  return headers
}

/** Transmission 首次调用必定返回 409 并带上 session id，需要带着它重试一次 */
async function call(cfg: BtClientConfig, method: string, args: Record<string, unknown>) {
  const send = (sessionId?: string) =>
    httpFetch(rpcUrl(cfg), {
      method: 'POST',
      timeoutMs: 10000,
      headers: headersOf(cfg, sessionId),
      body: JSON.stringify({ method, arguments: args })
    })

  let res = await send()
  if (res.status === 409) {
    const sessionId = res.headers.get('x-transmission-session-id')
    if (!sessionId) throw new Error('Transmission 返回 409 但没有 session id')
    res = await send(sessionId)
  }
  if (res.status === 401) throw new Error('Transmission 认证失败，请检查用户名 / 密码')
  if (!res.ok) throw new Error(`Transmission 返回 HTTP ${res.status}`)

  const data = (await res.json()) as { result?: string; arguments?: Record<string, any> }
  if (data.result && data.result !== 'success') throw new Error(`Transmission 调用失败：${data.result}`)
  return data.arguments || {}
}

export const transmissionAdapter: BtClientAdapter = {
  type: 'transmission',
  label: 'Transmission',
  defaultPort: 9091,
  defaultPath: '/transmission/rpc',

  async probe(cfg: BtClientConfig): Promise<ProbeResult> {
    const args = await call(cfg, 'session-get', {})
    return { online: true, version: args.version ? String(args.version) : undefined }
  },

  async add(cfg: BtClientConfig, input: AddTaskInput): Promise<AddTaskResult> {
    if (!input.magnet && !input.torrentBase64) throw new Error('缺少磁力链或种子文件内容')
    const args: Record<string, unknown> = {}
    if (input.magnet) args.filename = input.magnet
    else args.metainfo = input.torrentBase64
    const dir = input.downloadDir || cfg.downloadDir
    if (dir) args['download-dir'] = dir

    const result = await call(cfg, 'torrent-add', args)
    if (result['torrent-duplicate']) return { ok: true, message: 'Transmission 中已存在该任务（未重复添加）' }
    const added = result['torrent-added']
    return {
      ok: true,
      message: added?.name ? `已添加：${added.name}` : '已提交到 Transmission',
      detail: result
    }
  },

  async getTasks(cfg: BtClientConfig): Promise<BtTask[]> {
    const fields = ['hashString', 'name', 'percentDone', 'totalSize', 'downloadedEver', 'uploadedEver', 'rateDownload', 'rateUpload', 'status', 'eta']
    const result = await call(cfg, 'torrent-get', { fields })
    const list = (result.torrents || []) as any[]

    return list.map((t) => ({
      infoHash: t.hashString,
      name: t.name,
      progress: Number(t.percentDone) || 0,
      size: t.totalSize,
      downloaded: t.downloadedEver,
      uploaded: t.uploadedEver,
      dlspeed: t.rateDownload,
      upspeed: t.rateUpload,
      status: mapTransmissionStatus(t.status),
      eta: t.eta
    }))
  }
}

/**
 * 0: STOPPED (Paused)
 * 1: CHECK_WAIT
 * 2: CHECK
 * 3: DOWNLOAD_WAIT
 * 4: DOWNLOAD
 * 5: SEED_WAIT
 * 6: SEED
 */
function mapTransmissionStatus(status: number): BtTask['status'] {
  switch (status) {
    case 0: return 'paused'
    case 1:
    case 2: return 'checking'
    case 3:
    case 5: return 'queued'
    case 4: return 'downloading'
    case 6: return 'seeding'
    default: return 'unknown'
  }
}
