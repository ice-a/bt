import { buildMagnet } from '../torrent'
import { DEFAULT_UA, httpText } from '../http'
import type { ProviderContext, SearchProvider, SearchResult } from './types'

const HOMEPAGE = 'https://cilisousuo.cc'

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
  tb: 1024 ** 4,
  tib: 1024 ** 4
}

/** "330.3MB" / "1.1TB" → 字节数 */
function parseSize(input: unknown): number {
  const text = String(input || '').trim()
  const m = text.match(/^([\d.]+)\s*([a-zA-Z]+)?$/)
  if (!m) return 0
  const value = Number(m[1]) || 0
  const unit = (m[2] || 'b').toLowerCase()
  return Math.round(value * (SIZE_UNITS[unit] ?? 1))
}

function cilisousuoBase() {
  return (process.env.CILISOUSUO_BASE || HOMEPAGE).replace(/\/+$/, '')
}

/** 去掉 HTML 标签并解码常见实体 */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ListItem {
  title: string
  filename: string
  size: number
  code: string
}

/** 从列表页解析出条目（列表页只含名称/大小与 /magnet/{code}，infoHash 在详情页） */
function parseList(html: string): ListItem[] {
  const items: ListItem[] = []
  const liRe = /<li class="item">([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null
  while ((m = liRe.exec(html))) {
    const block = m[1]
    const titleM = block.match(/<div class="result-title">([\s\S]*?)<\/div>/)
    const fileM = block.match(/<div class="filename">([\s\S]*?)<\/div>/)
    const sizeM = block.match(/<div class="size">([\s\S]*?)<\/div>/)
    const codeM = block.match(/href="\/magnet\/([^"]+)"/)
    if (!codeM) continue
    const title = titleM ? stripHtml(titleM[1]) : ''
    const filename = fileM ? stripHtml(fileM[1]) : ''
    items.push({
      title,
      filename,
      size: sizeM ? parseSize(sizeM[1]) : 0,
      code: codeM[1]
    })
  }
  return items
}

/** 并发受限地映射 */
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return out
}

async function fetchDetail(it: ListItem, ctx: ProviderContext): Promise<SearchResult | null> {
  const url = `${cilisousuoBase()}/magnet/${it.code}`
  const html = await httpText(url, {
    proxy: ctx.proxy,
    timeoutMs: Math.min(ctx.timeoutMs, 8000),
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': DEFAULT_UA }
  })

  const hashM = html.match(/xt=urn:btih:([a-f0-9]{40})/i)
  if (!hashM) return null
  const infoHash = hashM[1].toLowerCase()
  const fileCountM = html.match(/文件数量[^\d]*<dd>\s*(\d+)/)
  const fileCount = fileCountM ? Number(fileCountM[1]) : null
  const name = it.title || it.filename || infoHash

  return {
    infoHash,
    name,
    size: it.size,
    seeders: null,
    leechers: null,
    fileCount,
    category: null,
    source: 'cilisousuo',
    sourceLabel: '磁力搜索',
    sourceId: it.code,
    sourceUrl: `${cilisousuoBase()}/magnet/${it.code}`,
    addedAt: null,
    magnet: buildMagnet(infoHash, name)
  } satisfies SearchResult
}

export const cilisousuoProvider: SearchProvider = {
  id: 'cilisousuo',
  label: '磁力搜索',
  homepage: HOMEPAGE,

  async search(query: string, ctx: ProviderContext): Promise<SearchResult[]> {
    const url = `${cilisousuoBase()}/search?q=${encodeURIComponent(query)}`
    const html = await httpText(url, {
      proxy: ctx.proxy,
      timeoutMs: ctx.timeoutMs,
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': DEFAULT_UA }
    })

    const items = parseList(html)
    if (!items.length) return []

    // 列表页不含 infoHash，逐条抓详情页补全磁力链；最多取前 24 条并发抓取
    const capped = items.slice(0, 24)
    const results = await mapWithConcurrency(capped, 5, (it) => fetchDetail(it, ctx).catch(() => null))
    return results.filter((x): x is SearchResult => x !== null)
  }
}
