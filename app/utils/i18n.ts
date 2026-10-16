import { en2zh, normalizeWs, zh2en } from './i18n-dict'

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'dsl-locale'

function readInitialLocale(): Locale {
  if (import.meta.client) {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'zh') return v
  }
  return 'en' // 默认英文
}

// 模块级响应式语言状态（默认英文）
export const locale = ref<Locale>(readInitialLocale())

export function setLocale(next: Locale) {
  locale.value = next
  if (import.meta.client) {
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
    translateDocument()
  }
}

/** 把一段中文（或英文）文本按当前语言翻译；找不到映射时原样返回 */
export function translateText(input: string): string {
  if (!input) return input
  const key = normalizeWs(input)
  const map = locale.value === 'zh' ? en2zh : zh2en
  return map[key] ?? input
}

/** 遍历 root 下的文本节点与常见属性，按当前语言就地翻译 */
export function walkAndTranslate(root: Node = document.body) {
  if (!root || !import.meta.client) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const fixes: { node: Text; text: string }[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = (n as Text).textContent || ''
    if (!t.trim()) continue
    const tr = translateText(t)
    if (tr !== t) fixes.push({ node: n as Text, text: tr })
  }
  for (const f of fixes) f.node.textContent = f.text

  // 翻译属性（title / placeholder / alt）
  if (root instanceof HTMLElement) {
    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      for (const attr of ['title', 'placeholder', 'alt']) {
        const v = el.getAttribute(attr)
        if (!v) continue
        const tr = translateText(v)
        if (tr !== v) el.setAttribute(attr, tr)
      }
    })
  }
}

export function translateDocument() {
  if (import.meta.client) walkAndTranslate(document.body)
}
