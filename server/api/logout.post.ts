// 退出登录：清除 HTTP-only 的访问 cookie
export default defineEventHandler((event) => {
  if (!process.env.WEBPASSWORD) return { ok: true }
  setCookie(event, 'web_unlock', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
  return { ok: true }
})
