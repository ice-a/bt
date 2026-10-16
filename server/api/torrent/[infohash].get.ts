import { tryMongo } from '../../utils/mongo'
import { getTorrent } from '../../utils/store'
import { parseMagnet } from '../../utils/torrent'

export default defineEventHandler(async (event) => {
  const infoHash = String(getRouterParam(event, 'infohash') || '').toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(infoHash)) {
    throw createError({ statusCode: 400, statusMessage: 'infoHash 格式不正确（应为 40 位 hex）' })
  }

  const doc = await tryMongo(() => getTorrent(infoHash))
  if (doc) {
    const { fileBase64, ...rest } = doc
    return { torrent: { ...rest, hasFile: !!fileBase64 }, source: 'database' as const }
  }

  const magnet = String(getQuery(event).magnet || '').trim()
  if (magnet) {
    try {
      return { torrent: await parseMagnet(magnet), source: 'query' as const }
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : '磁力链解析失败' })
    }
  }

  throw createError({ statusCode: 404, statusMessage: '该种子不在库中（MongoDB 未连接或未收录），请在链接上带上 magnet 参数' })
})
