// 校验站点访问密码（来自环境变量 WEBPASSWORD），成功后写入 HTTP-only cookie
export default defineEventHandler(async (event) => {
  const password = process.env.WEBPASSWORD
  if (!password) return { enabled: false }

  const body = await readBody<{ password?: string }>(event)
  if (body.password === password) {
    setCookie(event, 'web_unlock', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    })
    return { ok: true }
  }
  throw createError({ statusCode: 401, statusMessage: 'invalid password' })
})
