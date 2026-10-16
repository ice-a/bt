<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

const password = ref('')
const error = ref('')
const loading = ref(false)
const lockRemaining = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function fmt(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function startLock(sec: number) {
  lockRemaining.value = sec
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    lockRemaining.value -= 1
    if (lockRemaining.value <= 0 && timer) {
      clearInterval(timer)
      timer = undefined
      error.value = ''
    }
  }, 1000)
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

async function unlock() {
  if (lockRemaining.value > 0) return
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok?: boolean; enabled?: boolean; locked?: boolean; remainingSec?: number }>('/api/unlock', {
      method: 'POST',
      body: { password: password.value }
    })
    if (res && (res.ok || res.enabled === false)) {
      await navigateTo('/', { reload: true })
    } else if (res && res.locked) {
      error.value = '尝试次数过多，账户已锁定'
      startLock(res.remainingSec || 3600)
    } else {
      error.value = '密码错误'
    }
  } catch (e: unknown) {
    const data = (e as { data?: { statusMessage?: string; remainingSec?: number } })?.data
    if (data?.statusMessage === 'locked') {
      error.value = '尝试次数过多，账户已锁定'
      startLock(data.remainingSec || 3600)
    } else {
      error.value = '验证失败'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="gate">
    <form class="gate-card" @submit.prevent="unlock">
      <div class="brand-mark big">BT</div>
      <h1>需要密码</h1>
      <p class="mute">请输入访问密码以进入</p>
      <input
        v-model="password"
        type="password"
        class="input"
        placeholder="访问密码"
        autofocus
        :disabled="lockRemaining > 0"
        @keyup.enter="unlock"
      />
      <button class="btn btn-primary" type="submit" :disabled="loading || lockRemaining > 0">
        <span v-if="loading" class="spin" />
        {{ loading ? '验证中' : '进入' }}
      </button>
      <p v-if="error" class="err small">{{ error }}</p>
      <p v-if="lockRemaining > 0" class="err small">锁定剩余 <span class="mono">{{ fmt(lockRemaining) }}</span></p>
    </form>
  </div>
</template>

<style scoped>
.gate {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gate-card {
  width: 320px;
  max-width: 90vw;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--panel);
  padding: 28px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.brand-mark.big {
  width: 56px;
  height: 56px;
  font-size: 22px;
  margin: 0 auto;
}
.gate-card input {
  text-align: center;
}
</style>
