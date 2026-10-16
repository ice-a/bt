// 站点级访问门禁：仅当配置了 WEBPASSWORD 时启用。
// 验证通过后由 /api/unlock 写入 HTTP-only cookie，后续请求凭此放行。
export default defineEventHandler((event) => {
  const password = process.env.WEBPASSWORD
  // 未配置密码则站点完全开放
  if (!password) return

  const url = (event.node.req.url || '').split('?')[0]

  // 解锁接口、门禁页与 Nuxt 运行所需资源始终放行
  if (
    url === '/api/unlock' ||
    url === '/api/logout' ||
    url === '/gate' ||
    url.startsWith('/_nuxt') ||
    url.startsWith('/__nuxt') ||
    url.startsWith('/@vite') ||
    url.startsWith('/@fs') ||
    url === '/favicon.ico' ||
    url.startsWith('/favicon')
  ) {
    return
  }

  if (getCookie(event, 'web_unlock') === '1') return

  if (url.startsWith('/api/')) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
  return sendRedirect(event, '/gate')
})
