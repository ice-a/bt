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
    // 这些包体积大且带有原生/动态依赖，必须保持外部化，不能被打包进 Nitro 产物
    externals: {
      external: ['webtorrent', 'mongodb', 'parse-torrent', 'undici']
    }
  },
  vite: {
    server: {
      fs: { strict: false }
    }
  }
})
