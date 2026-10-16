import { downloadsCol, tryMongo } from '../utils/mongo'

/** 投递下载记录 */
export default defineEventHandler(async (event) => {
  const limit = Math.min(Number(getQuery(event).limit) || 30, 200)

  const data = await tryMongo(async () => {
    const col = await downloadsCol()
    const items = await col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
    return items.map((it) => ({ ...it, _id: String(it._id) }))
  })

  return { items: data || [], offline: data === null }
})
