import { loadSettings } from '../../../utils/appconfig'
import { tryMongo } from '../../../utils/mongo'
import { getTorrent, markResolved } from '../../../utils/store'
import { fetchMetadataFromMagnet } from '../../../utils/torrent'

// webtorrent 依赖 Node 运行时（需要 dgram / 原生模块），必须显式跑在 nodejs 而非 edge
export const runtime = 'nodejs'

export default defineEventHandler(async (event) => {
  const infoHash = String(getRouterParam(event, 'infohash') || '').toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(infoHash)) {
    throw createError({ statusCode: 400, statusMessage: 'infoHash 格式不正确（应为 40 位 hex）' })
  }

  const body = await readBody(event).catch(() => ({}))
  const doc = await tryMongo(() => getTorrent(infoHash))
  const magnet = String(body?.magnet || doc?.magnet || '').trim()
  if (!magnet) {
    throw createError({ statusCode: 400, statusMessage: '缺少磁力链，无法在线获取文件清单' })
  }

  const settings = await loadSettings()
  try {
    const meta = await fetchMetadataFromMagnet(magnet, settings.metadataTimeout)
    if (!meta.files.length) throw new Error('已连上节点，但对方没有返回任何文件信息')
    await tryMongo(() => markResolved(infoHash, { files: meta.files, size: meta.size, name: meta.name || doc?.name }, null))
    return { infoHash, name: meta.name, files: meta.files, size: meta.size }
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取种子元数据失败'
    await tryMongo(() => markResolved(infoHash, null, message))
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
