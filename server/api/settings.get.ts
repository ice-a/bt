import { loadSettings } from '../utils/appconfig'

/** 搜索源相关配置（不含任何下载器配置） */
export default defineEventHandler(async () => {
  const settings = await loadSettings()
  return {
    settings: {
      searchProxy: settings.searchProxy,
      searchTimeout: settings.searchTimeout,
      metadataTimeout: settings.metadataTimeout,
      enabledProviders: settings.enabledProviders
    }
  }
})
