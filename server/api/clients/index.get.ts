import { loadSettings, type BtClientConfig } from '../../utils/appconfig'
import { ADAPTERS, listClientStatuses } from '../../utils/clients'

/** 客户端配置 + 实时在线状态 */
export default defineEventHandler(async () => {
  const settings = await loadSettings()
  const statuses = await listClientStatuses()

  return {
    adapters: ADAPTERS.map((a) => ({
      type: a.type,
      label: a.label,
      defaultPort: a.defaultPort,
      defaultPath: a.defaultPath || null
    })),
    configs: settings.btClients as BtClientConfig[],
    statuses,
    online: statuses.filter((s) => s.online).length,
    total: statuses.length,
    settings: {
      searchProxy: settings.searchProxy,
      searchTimeout: settings.searchTimeout,
      metadataTimeout: settings.metadataTimeout,
      enabledProviders: settings.enabledProviders
    }
  }
})
