import { normalizeClient, saveSettings, type AppSettings, type BtClientConfig } from '../../utils/appconfig'

/** 保存客户端配置 / 搜索源配置 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const patch: Partial<AppSettings> = {}

  if (Array.isArray(body?.btClients)) {
    patch.btClients = (body.btClients as Partial<BtClientConfig>[]).map((raw, i) => normalizeClient(raw, i))
  }
  if (typeof body?.searchProxy === 'string') patch.searchProxy = body.searchProxy.trim()
  if (body?.searchTimeout != null) patch.searchTimeout = Math.min(Math.max(Number(body.searchTimeout) || 12000, 1000), 60000)
  if (body?.metadataTimeout != null) patch.metadataTimeout = Math.min(Math.max(Number(body.metadataTimeout) || 30000, 3000), 180000)
  if (Array.isArray(body?.enabledProviders) && body.enabledProviders.length) {
    patch.enabledProviders = body.enabledProviders.map((p: unknown) => String(p))
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: '没有可保存的字段' })
  }

  let settings: AppSettings
  try {
    settings = await saveSettings(patch)
  } catch (err) {
    throw createError({
      statusCode: 503,
      statusMessage: `MongoDB 不可用，配置无法保存：${err instanceof Error ? err.message : err}`
    })
  }
  return { ok: true, settings }
})
