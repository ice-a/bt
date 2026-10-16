import { torrentsCol, tryMongo } from '../utils/mongo'

/** 最近入库 / 已解析的种子列表 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 30, 200)
  const keyword = String(query.q || '').trim()
  const onlyResolved = String(query.resolved || '') === '1'

  const filter: Record<string, unknown> = {}
  if (onlyResolved) filter.resolvedAt = { $ne: null }
  if (keyword) filter.name = { $regex: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

  const data = await tryMongo(async () => {
    const col = await torrentsCol()
    const items = await col
      .find(filter, { projection: { fileBase64: 0 } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()
    return items.map((it) => ({ ...it, _id: String(it._id) }))
  })

  return { items: data || [], offline: data === null }
})
