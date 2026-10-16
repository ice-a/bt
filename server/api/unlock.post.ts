import { getRequestIP } from 'h3'
import { gatePassword, isGateEnabled, checkLock, registerFailure, registerSuccess } from '../utils/gate'

// 校验站点访问密码（来自环境变量 WEBPASSWORD），成功后写入 HTTP-only cookie；
// 同一 IP 输错 5 次锁定 1 小时。
export default defineEventHandler(async (event) => {
  if (!isGateEnabled()) return { enabled: false }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const lock = checkLock(ip)
  if (lock.locked) {
    return { ok: false, locked: true, remainingSec: lock.remainingSec }
  }

  const body = await readBody<{ password?: string }>(event)
  if (body.password === gatePassword()) {
    registerSuccess(ip)
    setCookie(event, 'web_unlock', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    })
    return { ok: true }
  }

  const after = registerFailure(ip)
  if (after.locked) {
    return { ok: false, locked: true, remainingSec: after.remainingSec }
  }
  return { ok: false, locked: false }
})
