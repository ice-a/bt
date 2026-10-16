<script setup lang="ts">
import { ref } from 'vue'

const password = ref('')
const error = ref('')
const loading = ref(false)

async function unlock() {
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch<{ ok?: boolean; enabled?: boolean }>('/api/unlock', {
      method: 'POST',
      body: { password: password.value }
    })
    if (res && (res.ok || res.enabled === false)) {
      await navigateTo('/', { reload: true })
    }
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    error.value = msg === 'invalid password' ? '密码错误' : '验证失败'
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
        @keyup.enter="unlock"
      />
      <button class="btn btn-primary" type="submit" :disabled="loading">
        <span v-if="loading" class="spin" />
        {{ loading ? '验证中' : '进入' }}
      </button>
      <p v-if="error" class="err small">{{ error }}</p>
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
