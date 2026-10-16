import { runSearch } from '../utils/search'
import { tryMongo } from '../utils/mongo'
import { recordSearch, upsertSearchResults } from '../utils/store'
import type { ProviderReport } from '../utils/search/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const keyword = String(query.q || '').trim()
  if (!keyword) throw createError({ statusCode: 400, statusMessage: '缺少查询参数 q' })

  const providers = String(query.providers || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const limit = Number(query.limit) || 0

  const started = Date.now()
  const { results, reports } = await runSearch(keyword, {
    providers: providers.length ? providers : undefined,
    limit: limit || 300
  })
  const durationMs = Date.now() - started

  const stored = await tryMongo(async () => {
    await recordSearch({
      keyword,
      providers: reports.filter((r) => r.ok).map((r) => r.id),
      resultCount: results.length,
      durationMs,
      ok: reports.some((r) => r.ok),
      error: reports.filter((r) => !r.ok).map((r: ProviderReport) => `${r.label}: ${r.error}`).join(' | ') || null
    })
    await upsertSearchResults(results)
    return true
  })

  return {
    query: keyword,
    durationMs,
    results,
    reports,
    stored: stored === true
  }
})
