import { searchesCol, torrentsCol, tryMongo } from '../utils/mongo'

/** 搜索历史 + 高频关键词 */
export default defineEventHandler(async (event) => {
  const limit = Math.min(Number(getQuery(event).limit) || 50, 200)

  const data = await tryMongo(async () => {
    const col = await searchesCol()
    const items = await col.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
    const hot = await col
      .aggregate<{ _id: string; count: number; last: Date }>([
        { $group: { _id: '$keyword', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
        { $sort: { count: -1, last: -1 } },
        { $limit: 12 }
      ])
      .toArray()
    const total = await col.estimatedDocumentCount()
    const torrentTotal = await (await torrentsCol()).estimatedDocumentCount()
    return {
      items: items.map((it) => ({ ...it, _id: String(it._id) })),
      hot: hot.map((h) => ({ keyword: h._id, count: h.count, last: h.last })),
      total,
      torrentTotal
    }
  })

  if (!data) {
    return { items: [], hot: [], total: 0, torrentTotal: 0, offline: true }
  }
  return { ...data, offline: false }
})
