// 站点门禁的失败次数 / 锁定状态（按客户端 IP，内存存储，单进程有效）
const MAX_ATTEMPTS = 5
const LOCK_MS = 60 * 60 * 1000 // 锁定 1 小时

type Attempt = { count: number; lockedUntil: number }
const attempts = new Map<string, Attempt>()

export function gatePassword(): string {
  return process.env.WEBPASSWORD || ''
}

export function isGateEnabled(): boolean {
  return !!gatePassword()
}

export function checkLock(ip: string): { locked: boolean; remainingSec: number } {
  const e = attempts.get(ip)
  if (!e) return { locked: false, remainingSec: 0 }
  const now = Date.now()
  if (e.lockedUntil > now) {
    return { locked: true, remainingSec: Math.ceil((e.lockedUntil - now) / 1000) }
  }
  if (e.lockedUntil > 0) {
    attempts.delete(ip) // 锁定已过期，重置计数
  }
  return { locked: false, remainingSec: 0 }
}

export function registerFailure(ip: string): { locked: boolean; remainingSec: number } {
  const e = attempts.get(ip) || { count: 0, lockedUntil: 0 }
  e.count += 1
  if (e.count >= MAX_ATTEMPTS) {
    e.lockedUntil = Date.now() + LOCK_MS
    e.count = 0
  }
  attempts.set(ip, e)
  return checkLock(ip)
}

export function registerSuccess(ip: string): void {
  attempts.delete(ip)
}
