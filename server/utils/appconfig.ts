import { getDb } from './mongo'

export type BtClientType = 'qbittorrent' | 'transmission' | 'aria2'

export interface BtClientConfig {
  id: string
  type: BtClientType
  name: string
  host: string
  port: number
  /** 自定义 RPC / API 路径，留空使用各客户端的默认路径 */
  path?: string
  username?: string
  password?: string
  downloadDir?: string
  useHttps?: boolean
  enabled?: boolean
}

export interface AppSettings {
  /** 访问搜索源时使用的 HTTP 代理 */
  searchProxy: string
  searchTimeout: number
  metadataTimeout: number
  enabledProviders: string[]
  btClients: BtClientConfig[]
}

/** 本机常见 BT 客户端的默认端点，用户没配置时自动探测这些 */
export const DEFAULT_CLIENTS: BtClientConfig[] = [
  { id: 'qbittorrent-local', type: 'qbittorrent', name: 'qBittorrent（本机）', host: '127.0.0.1', port: 8080, username: 'admin', password: '', enabled: true },
  { id: 'transmission-local', type: 'transmission', name: 'Transmission（本机）', host: '127.0.0.1', port: 9091, path: '/transmission/rpc', username: '', password: '', enabled: true },
  { id: 'aria2-local', type: 'aria2', name: 'aria2（本机）', host: '127.0.0.1', port: 6800, path: '/jsonrpc', password: '', enabled: true }
]

const SETTINGS_ID = 'app'

function envDefaults(): AppSettings {
  return {
    searchProxy: process.env.SEARCH_PROXY || '',
    searchTimeout: Number(process.env.SEARCH_TIMEOUT || 12000),
    metadataTimeout: Number(process.env.METADATA_TIMEOUT || 30000),
    enabledProviders: ['apibay', 'nyaa', 'cilisousuo'],
    btClients: DEFAULT_CLIENTS.map((c) => ({ ...c }))
  }
}

let cache: { value: AppSettings; at: number; ttl: number } | null = null

export function invalidateSettingsCache() {
  cache = null
}

export async function loadSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.value
  const base = envDefaults()
  try {
    const db = await getDb()
    const doc = await db.collection('settings').findOne({ _id: SETTINGS_ID as never })
    const stored = (doc?.value || {}) as Partial<AppSettings>
    const merged: AppSettings = { ...base, ...stored }
    if (!Array.isArray(merged.btClients) || merged.btClients.length === 0) merged.btClients = base.btClients
    if (!Array.isArray(merged.enabledProviders) || merged.enabledProviders.length === 0) {
      merged.enabledProviders = base.enabledProviders
    }
    cache = { value: merged, at: Date.now(), ttl: 5000 }
    return merged
  } catch {
    // MongoDB 不可用：短时缓存默认值，避免每个请求都卡 3 秒去连库
    cache = { value: base, at: Date.now(), ttl: 3000 }
    return base
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb()
  const current = await loadSettings()
  const next: AppSettings = { ...current, ...patch }
  await db
    .collection('settings')
    .updateOne(
      { _id: SETTINGS_ID as never },
      { $set: { value: next, updatedAt: new Date() } },
      { upsert: true }
    )
  cache = { value: next, at: Date.now(), ttl: 5000 }
  return next
}

export function normalizeClient(raw: Partial<BtClientConfig>, index = 0): BtClientConfig {
  const type = (raw.type || 'qbittorrent') as BtClientType
  return {
    id: raw.id || `${type}-${Date.now().toString(36)}-${index}`,
    type,
    name: raw.name || type,
    host: raw.host || '127.0.0.1',
    port: Number(raw.port) || defaultPort(type),
    path: raw.path || undefined,
    username: raw.username || '',
    password: raw.password || '',
    downloadDir: raw.downloadDir || '',
    useHttps: !!raw.useHttps,
    enabled: raw.enabled !== false
  }
}

export function defaultPort(type: BtClientType): number {
  if (type === 'transmission') return 9091
  if (type === 'aria2') return 6800
  return 8080
}

export function baseUrlOf(cfg: BtClientConfig): string {
  const scheme = cfg.useHttps ? 'https' : 'http'
  return `${scheme}://${cfg.host}:${cfg.port}`
}
