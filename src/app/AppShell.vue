<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DatabaseZap, LoaderCircle, LogOut, Moon, RefreshCw, ShieldCheck, Sparkles, Sun } from 'lucide-vue-next'
import { fetchHealth, type AuthUser, type HealthResponse } from '../shared/api'
import { portalPages, type MainPage, type ThemeMode } from './navigation'

const props = defineProps<{
  themeMode: ThemeMode
  activePage: MainPage
  authLoading: boolean
  currentUser: AuthUser
}>()

const emit = defineEmits<{
  'update:themeMode': [value: ThemeMode]
  'update:activePage': [value: MainPage]
  logout: []
}>()

const themeToggleIcon = computed(() => (props.themeMode === 'dark' ? Sun : Moon))
const health = ref<HealthResponse | null>(null)
const healthLoading = ref(false)
const healthError = ref('')
const currentUserInitial = computed(() => {
  const displayName = props.currentUser.display_name || props.currentUser.username || 'U'
  return displayName.slice(0, 1).toUpperCase()
})
const healthTone = computed(() => {
  if (healthLoading.value) return 'loading'
  if (healthError.value) return 'warn'
  if (health.value?.status === 'ok' && health.value?.qdrant === 'ok') return 'good'
  return 'warn'
})
const healthTitle = computed(() => {
  if (healthLoading.value) return '服务健康检查中'
  if (healthError.value) return `服务健康未知：${healthError.value}`
  const serviceStatus = statusLabel(health.value?.status)
  const qdrantStatus = statusLabel(health.value?.qdrant)
  const collectionName = health.value?.collection_name || '未知'
  return `服务：${serviceStatus}\nQdrant：${qdrantStatus}\nCollection：${collectionName}`
})
const healthIcon = computed(() => (health.value?.qdrant === 'ok' ? DatabaseZap : ShieldCheck))

function toggleTheme() {
  emit('update:themeMode', props.themeMode === 'dark' ? 'light' : 'dark')
}

function statusLabel(status?: string) {
  if (status === 'ok') return '正常'
  if (status === 'unavailable') return '不可用'
  if (status === 'degraded') return '降级'
  return '未知'
}

async function refreshHealth() {
  healthLoading.value = true
  healthError.value = ''
  try {
    health.value = await fetchHealth()
  } catch (error) {
    health.value = null
    healthError.value = error instanceof Error ? error.message : '健康检查失败'
  } finally {
    healthLoading.value = false
  }
}

onMounted(() => {
  void refreshHealth()
})
</script>

<template>
  <main class="portal-shell" :class="`theme-${themeMode}`">
    <aside class="portal-sidebar">
      <div class="portal-brand">
        <span class="portal-brand-mark"><Sparkles :size="18" /></span>
        <div>
          <h1>知习台</h1>
          <p>知识学习工作台</p>
        </div>
      </div>

      <nav class="portal-nav" aria-label="主页面导航">
        <button
          v-for="page in portalPages"
          :key="page.key"
          class="portal-nav-item"
          :class="{ active: activePage === page.key }"
          type="button"
          @click="emit('update:activePage', page.key)"
        >
          <span><component :is="page.icon" :size="16" /></span>
          <strong>{{ page.label }}</strong>
          <em>{{ page.subLabel }}</em>
        </button>
      </nav>

    </aside>

    <section class="portal-content" :class="`page-${activePage}`">
      <div class="portal-topbar">
        <div class="portal-account-panel" aria-label="账户操作">
          <button
            class="portal-icon-button portal-health-button"
            :class="`tone-${healthTone}`"
            type="button"
            :title="healthTitle"
            aria-label="服务健康状态"
            :disabled="healthLoading"
            @click="refreshHealth"
          >
            <RefreshCw v-if="healthLoading" class="spin" :size="16" />
            <component :is="healthIcon" v-else :size="16" />
          </button>

          <button
            class="portal-icon-button portal-profile-button"
            type="button"
            :title="currentUser.display_name || currentUser.username"
            aria-label="个人资料"
          >
            <span class="portal-user-avatar">{{ currentUserInitial }}</span>
          </button>

          <button
            class="portal-icon-button portal-logout-button"
            type="button"
            title="退出"
            aria-label="退出"
            :disabled="authLoading"
            @click="emit('logout')"
          >
            <LoaderCircle v-if="authLoading" class="spin" :size="16" />
            <LogOut v-else :size="16" />
          </button>

          <button
            class="portal-icon-button portal-theme-button"
            type="button"
            :title="themeMode === 'dark' ? '浅色模式' : '深色模式'"
            :aria-label="themeMode === 'dark' ? '浅色模式' : '深色模式'"
            @click="toggleTheme"
          >
            <component :is="themeToggleIcon" :size="16" />
          </button>
        </div>
      </div>

      <div class="portal-page-body">
        <slot />
      </div>
    </section>
  </main>
</template>
