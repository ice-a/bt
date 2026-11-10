import { searchesCol, tryMongo } from '../utils/mongo'

/** 删除单条历史（?id=）或清空全部历史 */
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id || '').trim()
  // 用正则本地校验，避免为「校验」而静态引入 mongodb（Cloudflare 等环境没有该包）
  if (id && !/^[a-f\d]{24}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'id 不是合法的 ObjectId' })
  }

  const result = await tryMongo(async () => {
    const { ObjectId } = await import('mongodb')
    const col = await searchesCol()
    if (id) {
      const res = await col.deleteOne({ _id: new ObjectId(id) })
      return { deleted: res.deletedCount }
    }
    const res = await col.deleteMany({})
    return { deleted: res.deletedCount }
  })

  if (!result) throw createError({ statusCode: 503, statusMessage: 'MongoDB 不可用，无法操作历史记录' })
  return { ok: true, ...result }
})
