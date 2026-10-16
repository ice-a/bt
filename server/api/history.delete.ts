import { ObjectId } from 'mongodb'
import { searchesCol, tryMongo } from '../utils/mongo'

/** 删除单条历史（?id=）或清空全部历史 */
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id || '').trim()
  if (id && !ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'id 不是合法的 ObjectId' })
  }

  const result = await tryMongo(async () => {
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
