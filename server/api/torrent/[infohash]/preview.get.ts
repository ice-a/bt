import { loadSettings } from '../../../utils/appconfig'
import { withSwarm } from '../../../utils/swarm'

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif'
}

/** 超过这个大小就不做在线预览了，从 swarm 拉一张大图的代价太高 */
const MAX_PREVIEW_BYTES = 12 * 1024 * 1024
/** 单张图片的下载时间上限 */
const DOWNLOAD_TIMEOUT_MS = 25_000

function normPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * 从 swarm 里只把某一张图片的字节拉下来用于预览。
 * 只下载该文件覆盖到的分片，不落库、不长期占用磁盘。
 */
export default defineEventHandler(async (event) => {
  const infoHash = String(getRouterParam(event, 'infohash') || '').toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(infoHash)) {
    throw createError({ statusCode: 400, statusMessage: 'infoHash 格式不正确' })
  }

  const query = getQuery(event)
  const magnet = String(query.magnet || '')
  const filePath = String(query.path || '')
  if (!/^magnet:\?/i.test(magnet)) {
    throw createError({ statusCode: 400, statusMessage: '缺少可用的磁力链，无法定位做种节点' })
  }
  if (!filePath) {
    throw createError({ statusCode: 400, statusMessage: '缺少 path 参数' })
  }

  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  const mime = IMAGE_TYPES[ext]
  if (!mime) {
    throw createError({ statusCode: 400, statusMessage: '只支持预览图片文件（jpg / png / gif / webp / bmp / avif）' })
  }

  const settings = await loadSettings()
  const bytes = await withSwarm(infoHash, magnet, settings.metadataTimeout, async (torrent) => {
    const target = (torrent.files || []).find(
      (f: any) => normPath(String(f.path || f.name || '')) === normPath(filePath)
    )
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: '这个种子里没有该文件，文件清单可能已过期' })
    }
    if (target.length > MAX_PREVIEW_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `这张图 ${Math.round(target.length / 1024 / 1024)} MB，超过在线预览上限 ${MAX_PREVIEW_BYTES / 1024 / 1024} MB`
      })
    }
    return Promise.race<ArrayBuffer>([
      target.arrayBuffer(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('下载图片超时：暂时没有可用的做种节点，稍后再试')),
          DOWNLOAD_TIMEOUT_MS
        )
      })
    ])
  })

  setHeader(event, 'content-type', mime)
  setHeader(event, 'content-length', String(bytes.byteLength))
  setHeader(
    event,
    'content-disposition',
    `inline; filename="${encodeURIComponent(filePath.slice(filePath.lastIndexOf('/') + 1))}"`
  )
  setHeader(event, 'cache-control', 'private, max-age=3600')
  return Buffer.from(bytes)
})
