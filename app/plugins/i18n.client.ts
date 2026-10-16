import { locale, translateDocument } from '~/utils/i18n'

export default defineNuxtPlugin(() => {
  const applyLangAttr = () => {
    if (import.meta.client) {
      document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
    }
  }

  const run = () => {
    translateDocument()
    applyLangAttr()
  }

  // 初次翻译：等 DOM 就绪
  if (import.meta.client) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true })
    } else {
      run()
    }
  }

  // 客户端渲染 / 数据刷新会改变 DOM，用 MutationObserver 兜底重新翻译
  if (import.meta.client) {
    let scheduled = false
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        translateDocument()
      })
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    // 路由切换
    const router = useRouter()
    router.afterEach(() => nextTick(schedule))

    // 语言切换时整体重翻
    watch(locale, () => {
      applyLangAttr()
      translateDocument()
    })
  }
})
