// 把 webtorrent 的 UMD 包拷到 public/，由我们自己的域名同源提供，
// 避免依赖 jsDelivr / unpkg 等外部 CDN（在国内经常被网络或 CSP 拦截）。
// webtorrent 是 package.json 里的常规依赖，构建时一定在 node_modules 中。
import { copyFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/webtorrent/dist/webtorrent.min.js')
const dest = resolve(root, 'public/webtorrent.min.js')

try {
  await access(src)
  await copyFile(src, dest)
  console.log('[copy-webtorrent] 已复制 webtorrent.min.js -> public/webtorrent.min.js（同源提供，避免 CDN 被拦截）')
} catch (err) {
  // 包没装也不阻塞构建；运行时仍可回退到外部 CDN
  console.warn('[copy-webtorrent] 跳过：未在 node_modules 找到 webtorrent 包（', err.message, '）')
}
