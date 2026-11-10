import { getDb } from './mongo'

export interface AppSettings {
  /** 访问搜索源时使用的 HTTP 代理 */
  searchProxy: string
  searchTimeout: number
  metadataTimeout: number
  enabledProviders: string[]
}

const SETTINGS_ID = 'app'

function envDefaults(): AppSettings {
  return {
    searchProxy: process.env.SEARCH_PROXY || '',
    searchTimeout: Number(process.env.SEARCH_TIMEOUT || 12000),
    metadataTimeout: Number(process.env.METADATA_TIMEOUT || 30000),
    enabledProviders: ['apibay', 'nyaa', 'cilisousuo']
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
    if (!Array.isArray(merged.enabledProviders) || merged.enabledProviders.length === 0) {
      merged.enabledProviders = base.enabledProviders
    }
    cache = { value: merged, at: Date.now(), ttl: 5000 }
    return merged
  } catch {
    // MongoDB 不可用：短时缓存默认值，避免每个请求都卡去连库
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
