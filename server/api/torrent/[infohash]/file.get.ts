import { tryMongo } from '../../../utils/mongo'
import { getTorrent } from '../../../utils/store'

/** 下载用户上传时的原始 .torrent 文件 */
export default defineEventHandler(async (event) => {
  const infoHash = String(getRouterParam(event, 'infohash') || '').toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(infoHash)) {
    throw createError({ statusCode: 400, statusMessage: 'infoHash 格式不正确' })
  }

  const doc = await tryMongo(() => getTorrent(infoHash))
  if (!doc?.fileBase64) {
    throw createError({ statusCode: 404, statusMessage: '没有保存该种子的原始文件（只有手动上传的种子会保存）' })
  }

  const bytes = Buffer.from(doc.fileBase64, 'base64')
  setHeader(event, 'content-type', 'application/x-bittorrent')
  setHeader(event, 'content-length', String(bytes.length))
  setHeader(
    event,
    'content-disposition',
    `attachment; filename="${encodeURIComponent((doc.name || infoHash).slice(0, 120))}.torrent"`
  )
  return bytes
})
