// Cloudflare 部署用桩：Workers 不支持 TCP 代理，undici 的 ProxyAgent 在此环境没有意义。
// 仅在「配置了代理 + Node 运行时」时才动态加载；Cloudflare 上走全局 fetch 直连，不会用到它。
export class ProxyAgent {
  constructor() {
    throw new Error('undici ProxyAgent 在此运行环境（Cloudflare Serverless）不可用')
  }
}
export const fetch = globalThis.fetch
