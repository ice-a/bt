import { searchesCol, tryMongo } from '../utils/mongo'

/** 热搜关键词：按搜索次数降序，返回前 N 个 */
export default defineEventHandler(async (event) => {
  const limit = Math.min(Number(getQuery(event).limit) || 10, 50)

  const data = await tryMongo(async () => {
    const col = await searchesCol()
    const hot = await col
      .aggregate<{ _id: string; count: number; last: Date }>([
        { $group: { _id: '$keyword', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
        { $sort: { count: -1, last: -1 } },
        { $limit: limit }
      ])
      .toArray()
    return hot.map((h) => ({ keyword: h._id, count: h.count, last: h.last }))
  })

  if (!data) return { keywords: [], offline: true }
  return { keywords: data, offline: false }
})
