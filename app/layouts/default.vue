<script setup lang="ts">
import { locale, setLocale, type Locale } from '~/utils/i18n'

const route = useRoute()
const health = useHealth()

const lang = computed<Locale>({
  get: () => locale.value,
  set: (v) => setLocale(v)
})

onMounted(() => {
  refreshHealth()
})

const mongoPill = computed(() => {
  if (!health.value) return { cls: '', text: 'MONGO ?' }
  return health.value.mongo.ok
    ? { cls: 'on', text: 'MONGO' }
    : { cls: 'off', text: 'MONGO 未连接' }
})

async function logout() {
  await $fetch('/api/logout', { method: 'POST' }).catch(() => {})
  await navigateTo('/gate', { reload: true })
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="wrap topbar-in">
        <NuxtLink to="/" class="brand">
          <span class="brand-mark">BT</span>
          <span>
            <span class="brand-name">Torrent Console</span><br />
            <span class="brand-sub">预览台 / 投递器</span>
          </span>
        </NuxtLink>

        <nav class="nav">
          <NuxtLink to="/" :class="{ active: route.path === '/' }">搜索</NuxtLink>
          <NuxtLink to="/downloads" :class="{ active: route.path === '/downloads' }">任务</NuxtLink>
          <NuxtLink to="/history" :class="{ active: route.path === '/history' }">历史</NuxtLink>
          <NuxtLink to="/settings" :class="{ active: route.path === '/settings' }">设置</NuxtLink>
        </nav>

        <div class="topbar-right">
          <span class="pill hide-sm" :class="health && !health.webTorrent ? 'warn' : ''">
            <i class="dot" />
            {{ health?.webTorrent ? '磁力解析就绪' : '磁力解析不可用' }}
          </span>
          <NuxtLink to="/settings" class="pill" :class="mongoPill.cls">
            <i class="dot" />
            {{ mongoPill.text }}
          </NuxtLink>
          <button v-if="health?.authed" class="pill" type="button" @click="logout" title="退出登录">退出</button>
          <select class="pill lang-select" v-model="lang" title="Language" aria-label="Language">
            <option value="en">EN</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </div>
    </header>

    <main class="grow wrap">
      <slot />
    </main>

    <footer class="footer">
      <div class="wrap spread">
        <span>本地自托管 · 单进程 Nuxt 单体应用</span>
        <span class="mute">种子只做解析与预览，文件内容由你自己的下载器拉取</span>
      </div>
    </footer>
  </div>
</template>
