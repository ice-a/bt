import { tryMongo } from '../utils/mongo'
import { getTorrent, recordDownload } from '../utils/store'
import { friendlyClientError, sendTask } from '../utils/clients'

/** 把种子投递到本机 BT 下载工具 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const clientId = String(body?.clientId || '').trim()
  if (!clientId) throw createError({ statusCode: 400, statusMessage: '缺少 clientId' })

  const infoHash = String(body?.infoHash || '').toLowerCase() || null
  let magnet = String(body?.magnet || '').trim() || undefined
  let torrentBase64 = String(body?.torrentBase64 || '').trim() || undefined
  let name = String(body?.name || '').trim()
  const downloadDir = String(body?.downloadDir || '').trim() || undefined

  if (!magnet && !torrentBase64) {
    if (!infoHash) {
      throw createError({ statusCode: 400, statusMessage: '需要提供 infoHash、magnet 或 torrentBase64 之一' })
    }
    const doc = await tryMongo(() => getTorrent(infoHash))
    if (!doc) throw createError({ statusCode: 404, statusMessage: '库中找不到该种子，请把 magnet 一起传上来' })
    magnet = doc.magnet || undefined
    torrentBase64 = doc.fileBase64 || undefined
    name = name || doc.name
  }

  let result: { ok: boolean; message: string; client: { id: string; type: string; name: string } | null }
  try {
    result = await sendTask(clientId, { magnet, torrentBase64, downloadDir, name })
  } catch (err) {
    const message = friendlyClientError(err)
    await tryMongo(() =>
      recordDownload({
        infoHash,
        name: name || magnet?.slice(0, 80) || '未知任务',
        clientId,
        clientType: '',
        clientName: '',
        downloadDir: downloadDir || null,
        ok: false,
        message
      })
    )
    throw createError({ statusCode: 502, statusMessage: message })
  }

  await tryMongo(() =>
    recordDownload({
      infoHash,
      name: name || magnet?.slice(0, 80) || '未知任务',
      clientId,
      clientType: result.client?.type || '',
      clientName: result.client?.name || '',
      downloadDir: downloadDir || null,
      ok: result.ok,
      message: result.message
    })
  )

  return { ok: result.ok, message: result.message, client: result.client }
})
