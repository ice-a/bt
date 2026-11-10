import { mongoStatus } from '../utils/mongo'
import { listProviders } from '../utils/search'
import { checkWebTorrent } from '../utils/torrent'
import { loadSettings } from '../utils/appconfig'

export default defineEventHandler(async (event) => {
  const [mongo, webTorrent, settings] = await Promise.all([mongoStatus(), checkWebTorrent(), loadSettings()])
  return {
    ok: true,
    time: new Date().toISOString(),
    mongo,
    webTorrent,
    providers: listProviders(),
    enabledProviders: settings.enabledProviders,
    searchProxy: settings.searchProxy ? '已配置' : '未配置',
    authed: getCookie(event, 'web_unlock') === '1'
  }
})
