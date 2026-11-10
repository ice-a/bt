<script setup lang="ts">
const health = useHealth()

const loading = ref(true)
const saving = ref(false)
const enabledProviders = ref<string[]>([])
const searchProxy = ref('')
const searchTimeout = ref(12000)
const metadataTimeout = ref(30000)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{
      settings: { searchProxy: string; searchTimeout: number; metadataTimeout: number; enabledProviders: string[] }
    }>('/api/settings')
    enabledProviders.value = res.settings.enabledProviders
    searchProxy.value = res.settings.searchProxy
    searchTimeout.value = res.settings.searchTimeout
    metadataTimeout.value = res.settings.metadataTimeout
  } catch (err) {
    pushToast('err', '读取配置失败', errorMessage(err))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: {
        enabledProviders: enabledProviders.value,
        searchProxy: searchProxy.value,
        searchTimeout: searchTimeout.value,
        metadataTimeout: metadataTimeout.value
      }
    })
    pushToast('ok', '配置已保存')
    await load()
  } catch (err) {
    pushToast('err', '保存失败', errorMessage(err))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <section class="rise">
      <p class="label">SETTINGS · SEARCH SOURCES</p>
      <h1>搜索源设置</h1>
      <p class="sub">
        所有配置写在 MongoDB 的 settings 集合里（没连库时回落到 .env）。本应用只做种子解析与预览，不负责实际下载。
      </p>
    </section>

    <div class="row mt rise rise-2">
      <button class="btn btn-primary" :disabled="saving || loading" @click="save">
        <span v-if="saving" class="spin" />{{ saving ? '保存中…' : '保存全部配置' }}
      </button>
      <button class="btn btn-ghost" :disabled="loading" @click="load">重新加载</button>
      <span v-if="health && !health.mongo.ok" class="small warn">MongoDB 未连接，配置只能在本次运行内生效</span>
    </div>

    <!-- ============ 搜索源 ============ -->
    <div class="panel mt rise rise-2">
      <div class="panel-hd"><span class="label">SEARCH SOURCES</span></div>
      <div class="panel-bd stack">
        <div class="row wrap">
          <span class="label">启用的搜索源</span>
          <label v-for="p in health?.providers || []" :key="p.id" class="check">
            <input v-model="enabledProviders" type="checkbox" :value="p.id" />
            {{ p.label }}
            <span class="mute small">{{ p.homepage }}</span>
          </label>
        </div>

        <div class="grid-3">
          <label class="field">
            <span class="label">HTTP 代理（搜索源用）</span>
            <input v-model="searchProxy" class="input" placeholder="http://127.0.0.1:7890 / 留空直连" />
          </label>
          <label class="field">
            <span class="label">搜索超时（毫秒）</span>
            <input v-model.number="searchTimeout" class="input" type="number" min="1000" max="60000" step="500" />
          </label>
          <label class="field">
            <span class="label">元数据解析超时（毫秒）</span>
            <input v-model.number="metadataTimeout" class="input" type="number" min="3000" max="180000" step="1000" />
          </label>
        </div>

        <div class="note">
          公开磁力站在部分网络环境下不可直连，配好代理后「保存」再回搜索页重试即可。
        </div>
      </div>
    </div>

    <!-- ============ 环境信息 ============ -->
    <div class="panel mt rise rise-4">
      <div class="panel-hd"><span class="label">RUNTIME</span></div>
      <div class="panel-bd">
        <dl class="kv">
          <dt>MongoDB</dt>
          <dd>
            <span :class="health?.mongo.ok ? 'ok' : 'err'">{{ health?.mongo.ok ? '已连接' : '未连接' }}</span>
          </dd>
          <dt>磁力解析</dt>
          <dd :class="health?.webTorrent ? 'ok' : 'warn'">
            {{ health?.webTorrent ? 'webtorrent 可用，可通过 DHT/tracker 取文件清单' : 'webtorrent 不可用，但通过 torrent 缓存服务在线取清单（不走 DHT）' }}
          </dd>
          <dt>搜索源</dt>
          <dd class="mono small">{{ health?.providers?.map((p) => p.label).join(' / ') }}</dd>
          <dt>代理</dt>
          <dd class="mono small">{{ health?.searchProxy }}</dd>
        </dl>
      </div>
    </div>
  </div>
</template>
