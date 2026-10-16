import { normalizeClient, type BtClientConfig } from '../../utils/appconfig'
import { endpointOf, friendlyClientError, getAdapter } from '../../utils/clients'

/** 保存前先试连一次，确认地址 / 账号可用 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const cfg: BtClientConfig = normalizeClient((body?.client || body) as Partial<BtClientConfig>)
  const adapter = getAdapter(cfg.type)
  if (!adapter) throw createError({ statusCode: 400, statusMessage: `不支持的客户端类型：${cfg.type}` })

  try {
    const result = await adapter.probe(cfg)
    return { ok: true, online: result.online, version: result.version || null, endpoint: endpointOf(cfg) }
  } catch (err) {
    return {
      ok: false,
      online: false,
      endpoint: endpointOf(cfg),
      error: friendlyClientError(err)
    }
  }
})
