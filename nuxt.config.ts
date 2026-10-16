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
        { name: 'description', content: '搜索 / 解析 / 预览 BT 种子内容，并投递到本机下载工具' }
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
