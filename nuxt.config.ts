export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'BT 种子预览台',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '搜索 / 解析 / 预览 BT 种子内容，并投递到本机下载工具' },
        { name: 'theme-color', content: '#0f0f11' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'BT 预览台' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'apple-touch-icon', href: '/icon.svg', sizes: 'any' }
      ]
    }
  },
  nitro: {
    // 构建目标：本地 / Docker 走默认 Node 服务；部署到 Cloudflare 时用
    //   NITRO_PRESET=cloudflare_pages npm run build
    // 来切换。Cloudflare Serverless 没有 TCP / 原生模块，webtorrent / mongodb / undici
    // 都改成运行时按需加载（见 server/utils 下对应模块），缺失即降级。
    preset: process.env.NITRO_PRESET || undefined,
    // Node 部署：保持外部化，避免打进产物。
    // Cloudflare 部署：把无法运行的包别名到桩文件，动态 import 失败时由调用方捕获降级。
    externals: {
      external: process.env.NITRO_PRESET === 'cloudflare_pages' ? [] : ['webtorrent', 'mongodb', 'parse-torrent', 'undici']
    },
    alias:
      process.env.NITRO_PRESET === 'cloudflare_pages'
        ? {
            mongodb: './stubs/mongodb.mjs',
            undici: './stubs/undici.mjs',
            webtorrent: './stubs/webtorrent.mjs'
          }
        : {}
  },
  vite: {
    server: {
      fs: { strict: false }
    }
  }
})
