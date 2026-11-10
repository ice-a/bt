// 只缓存静态资源（/manifest.json、/icon.svg、/_nuxt/*），绝不缓存 HTML 导航页。
// 早期版本把 '/'、'/gate'、'/settings' 等 HTML 页面也缓存了，会导致
// 「第一次能打开、之后打不开（ERR_FAILED）」——旧 shell 被反复返回、其引用的资源又拉不到。
// 这里改成：导航请求始终走网络；静态资源 cache-first；更新时清掉旧缓存。
const CACHE_NAME = 'bt-preview-v2'
const STATIC = ['/manifest.json', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // API / 预览 / 下载等动态请求一律走网络
  if (url.pathname.startsWith('/api/')) return

  // 导航请求（HTML 页面）：始终走网络，像普通网页一样（本应用依赖 API / P2P，离线无意义，
  // 也不缓存 HTML，避免「首次可开、之后打不开」）。
  if (request.mode === 'navigate') {
    return
  }

  // 其余静态资源：cache-first，命中即返回；未命中则网络拉取并写入缓存
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
        }
        return res
      })
    })
  )
})
