import { parseMagnet, parseTorrentBuffer } from '../utils/torrent'
import { tryMongo } from '../utils/mongo'
import { upsertParsedTorrent } from '../utils/store'

const MAX_UPLOAD = 4 * 1024 * 1024
const MAX_INLINE_STORE = 1024 * 1024

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') || ''

  let info
  let fileBase64: string | null = null
  let originalName: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const filePart = parts?.find((p) => p.name === 'file' && p.data?.length)
    if (!filePart) throw createError({ statusCode: 400, statusMessage: '没有收到种子文件（字段名应为 file）' })
    if (filePart.data.length > MAX_UPLOAD) {
      throw createError({ statusCode: 413, statusMessage: `种子文件过大（上限 ${MAX_UPLOAD / 1024 / 1024}MB）` })
    }
    try {
      info = await parseTorrentBuffer(filePart.data)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : '种子文件解析失败' })
    }
    originalName = filePart.filename || null
    if (filePart.data.length <= MAX_INLINE_STORE) fileBase64 = filePart.data.toString('base64')
  } else {
    const body = await readBody(event).catch(() => ({}))
    const magnet = String(body?.magnet || '').trim()
    if (!magnet) throw createError({ statusCode: 400, statusMessage: '请上传 .torrent 文件，或提供 magnet 字段' })
    try {
      info = await parseMagnet(magnet)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: err instanceof Error ? err.message : '磁力链接解析失败' })
    }
  }

  const stored = await tryMongo(async () => {
    await upsertParsedTorrent(info!, { fileBase64, originalName, source: fileBase64 ? 'upload' : 'magnet' })
    return true
  })

  return { torrent: { ...info, hasFile: !!fileBase64 }, stored: stored === true, fromUpload: !!fileBase64 }
})
