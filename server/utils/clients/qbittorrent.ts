import { baseUrlOf, type BtClientConfig } from '../appconfig'
import { httpFetch } from '../http'
import type { AddTaskInput, AddTaskResult, BtClientAdapter, ProbeResult } from './types'

function base(cfg: BtClientConfig) {
  return baseUrlOf(cfg)
}

/** 登录拿到 SID Cookie；新版 qBittorrent（5.x）Cookie 名为 QBT_SID_<port>，这里统一透传 */
async function login(cfg: BtClientConfig): Promise<string> {
  const url = `${base(cfg)}/api/v2/auth/login`
  const body = new URLSearchParams({
    username: cfg.username || 'admin',
    password: cfg.password || ''
  })
  const res = await httpFetch(url, {
    method: 'POST',
    body,
    timeoutMs: 6000,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      referer: base(cfg),
      origin: base(cfg)
    }
  })
  const cookies = res.headers.getSetCookie?.() ?? []
  const sid = cookies.map((c) => c.split(';')[0]).join('; ')
  const text = (await res.text()).trim()

  if (text === 'Fails.') throw new Error('qBittorrent 用户名或密码错误')
  if (!res.ok || (text && text !== 'Ok.')) throw new Error(`qBittorrent 登录失败：${text || `HTTP ${res.status}`}`)
  return sid
}

export const qbittorrentAdapter: BtClientAdapter = {
  type: 'qbittorrent',
  label: 'qBittorrent',
  defaultPort: 8080,

  async probe(cfg: BtClientConfig): Promise<ProbeResult> {
    let sid = ''
    try {
      sid = await login(cfg)
    } catch (err) {
      // 有些配置开启了「本机免密」，登录失败但接口仍可访问，继续尝试读取版本
      const fallback = await httpFetch(`${base(cfg)}/api/v2/app/version`, { timeoutMs: 5000 })
      if (!fallback.ok) throw err
      return { online: true, version: (await fallback.text()).trim().replace(/^v/, '') }
    }
    const res = await httpFetch(`${base(cfg)}/api/v2/app/version`, {
      timeoutMs: 5000,
      headers: sid ? { cookie: sid } : {}
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { online: true, version: (await res.text()).trim().replace(/^v/, '') }
  },

  async add(cfg: BtClientConfig, input: AddTaskInput): Promise<AddTaskResult> {
    if (!input.magnet && !input.torrentBase64) throw new Error('缺少磁力链或种子文件内容')
    const sid = await login(cfg)

    const form = new FormData()
    if (input.magnet) form.append('urls', input.magnet)
    if (input.torrentBase64) {
      const bytes = Buffer.from(input.torrentBase64, 'base64')
      form.append('torrents', new Blob([bytes], { type: 'application/x-bittorrent' }), 'upload.torrent')
    }
    const savePath = input.downloadDir || cfg.downloadDir
    if (savePath) form.append('savepath', savePath)
    form.append('paused', 'false')

    const res = await httpFetch(`${base(cfg)}/api/v2/torrents/add`, {
      method: 'POST',
      body: form,
      timeoutMs: 15000,
      headers: sid ? { cookie: sid, referer: base(cfg), origin: base(cfg) } : { referer: base(cfg) }
    })
    const text = (await res.text()).trim()
    if (!res.ok) throw new Error(`qBittorrent 返回 HTTP ${res.status}${text ? `：${text}` : ''}`)
    if (text === 'Fails.') throw new Error('qBittorrent 拒绝了该任务（可能是种子重复或路径不可用）')
    return { ok: true, message: '已提交到 qBittorrent', detail: text }
  },

  async getTasks(cfg: BtClientConfig): Promise<BtTask[]> {
    let sid = ''
    try {
      sid = await login(cfg)
    } catch {
      /* ignore login failure for local bypass */
    }
    const res = await httpFetch(`${base(cfg)}/api/v2/torrents/info`, {
      headers: sid ? { cookie: sid } : {}
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const list = (await res.json()) as any[]

    return list.map((t) => ({
      infoHash: t.hash,
      name: t.name,
      progress: t.progress,
      size: t.size,
      downloaded: t.downloaded,
      uploaded: t.uploaded,
      dlspeed: t.dlspeed,
      upspeed: t.upspeed,
      status: mapQbtStatus(t.state),
      eta: t.eta
    }))
  }
}

function mapQbtStatus(state: string): BtTask['status'] {
  const s = state.toLowerCase()
  if (s.includes('error') || s.includes('missing')) return 'error'
  if (s.includes('checking')) return 'checking'
  if (s.includes('paused')) return 'paused'
  if (s.includes('queued')) return 'queued'
  if (s.includes('dl')) return 'downloading'
  if (s.includes('up')) return 'seeding'
  if (s === 'completed' || s === 'uploading') return 'seeding'
  return 'unknown'
}
