import { loadSettings } from '../appconfig'
import { apibayProvider } from './apibay'
import { cilisousuoProvider } from './cilisousuo'
import { nyaaProvider } from './nyaa'
import { solidtorrentsProvider } from './solidtorrents'
import type { ProviderReport, SearchProvider, SearchResult } from './types'

export const PROVIDERS: SearchProvider[] = [apibayProvider, nyaaProvider, solidtorrentsProvider, cilisousuoProvider]

export function listProviders() {
  return PROVIDERS.map((p) => ({ id: p.id, label: p.label, homepage: p.homepage }))
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg)) {
    return '网络不可达，通常是站点被墙，请在「设置」里配置 HTTP 代理后重试'
  }
  if (/aborted|超时/.test(msg)) return msg
  if (/HTTP 5\d\d/.test(msg)) return `源站异常：${msg}`
  if (/HTTP 4\d\d/.test(msg)) return `源站拒绝访问：${msg}`
  return msg
}

export interface RunSearchOptions {
  providers?: string[]
  limit?: number
}

export interface RunSearchResult {
  results: SearchResult[]
  reports: ProviderReport[]
}

export async function runSearch(query: string, options: RunSearchOptions = {}): Promise<RunSearchResult> {
  const settings = await loadSettings()
  const wanted = options.providers?.length ? options.providers : settings.enabledProviders
  const targets = PROVIDERS.filter((p) => wanted.includes(p.id))
  const ctx = { proxy: settings.searchProxy || null, timeoutMs: settings.searchTimeout }

  const reports = await Promise.all(
    targets.map(async (provider): Promise<ProviderReport & { results: SearchResult[] }> => {
      const started = Date.now()
      try {
        const results = await provider.search(query, ctx)
        return {
          id: provider.id,
          label: provider.label,
          ok: true,
          count: results.length,
          ms: Date.now() - started,
          error: null,
          results
        }
      } catch (err) {
        return {
          id: provider.id,
          label: provider.label,
          ok: false,
          count: 0,
          ms: Date.now() - started,
          error: friendlyError(err),
          results: []
        }
      }
    })
  )

  // 按 infoHash 去重，保留做种数更高的那条
  const merged = new Map<string, SearchResult>()
  for (const report of reports) {
    for (const item of report.results) {
      const exists = merged.get(item.infoHash)
      if (!exists || (item.seeders ?? 0) > (exists.seeders ?? 0)) merged.set(item.infoHash, item)
    }
  }

  const results = [...merged.values()].sort(
    (a, b) => (b.seeders ?? 0) - (a.seeders ?? 0) || b.size - a.size
  )

  return {
    results: options.limit ? results.slice(0, options.limit) : results,
    reports: reports.map(({ results: _omit, ...rest }) => rest)
  }
}
