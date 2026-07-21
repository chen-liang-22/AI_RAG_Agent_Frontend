<script setup lang="ts">
import { computed } from 'vue'
import { DatabaseZap, LoaderCircle, LogOut, Moon, RefreshCw, ShieldCheck, Sparkles, Sun } from 'lucide-vue-next'
import type { AuthUser, HealthResponse } from '../shared/api'
import { type MainPage, type PortalMenuItem, type ThemeMode } from './navigation'
import PortalNavTree from './PortalNavTree.vue'

const props = defineProps<{
  themeMode: ThemeMode
  activePage: MainPage
  authLoading: boolean
  currentUser: AuthUser
  menus?: PortalMenuItem[]
  health: HealthResponse | null
  healthLoading: boolean
  healthError: string
}>()

const emit = defineEmits<{
  'update:themeMode': [value: ThemeMode]
  'update:activePage': [value: MainPage]
  navigate: [value: MainPage]
  refreshHealth: []
  logout: []
}>()

const themeToggleIcon = computed(() => (props.themeMode === 'dark' ? Sun : Moon))
const navigationMenus = computed(() => props.menus || [])
const currentUserInitial = computed(() => {
  const displayName = props.currentUser.display_name || props.currentUser.username || 'U'
  return displayName.slice(0, 1).toUpperCase()
})
const activeMenuKeys = computed(() => {
  // 父级目录在任一子页面激活时也要保持高亮。
  const keys = new Set<string>()
  const visit = (items: PortalMenuItem[], parent?: PortalMenuItem) => {
    for (const item of items) {
      if (item.pageKey === props.activePage) {
        keys.add(item.key)
        if (parent) keys.add(parent.key)
      }
      visit(item.children, item)
    }
  }
  visit(navigationMenus.value)
  return keys
})
const healthTone = computed(() => {
  if (props.healthLoading) return 'loading'
  if (props.healthError) return 'warn'
  if (props.health?.status === 'ok' && props.health?.qdrant === 'ok') return 'good'
  return 'warn'
})
const healthTitle = computed(() => {
  if (props.healthLoading) return '服务健康检查中'
  if (props.healthError) return `服务健康未知：${props.healthError}`
  const serviceStatus = statusLabel(props.health?.status)
  const qdrantStatus = statusLabel(props.health?.qdrant)
  const collectionName = props.health?.collection_name || '未知'
  return `服务：${serviceStatus}\nQdrant：${qdrantStatus}\nCollection：${collectionName}`
})
const healthIcon = computed(() => (props.health?.qdrant === 'ok' ? DatabaseZap : ShieldCheck))

function toggleTheme() {
  emit('update:themeMode', props.themeMode === 'dark' ? 'light' : 'dark')
}

function openMenu(item: PortalMenuItem) {
  if (!item.pageKey) return
  emit('update:activePage', item.pageKey)
  emit('navigate', item.pageKey)
}

function statusLabel(status?: string) {
  if (status === 'ok') return '正常'
  if (status === 'unavailable') return '不可用'
  if (status === 'degraded') return '降级'
  return '未知'
}

</script>

<template>
  <main class="portal-shell" :class="`theme-${themeMode}`">
    <aside class="portal-sidebar">
      <div class="portal-brand">
        <span class="portal-brand-mark"><Sparkles :size="18" /></span>
        <div>
          <h1>知域</h1>
          <p>Nexus · 知识工作台</p>
        </div>
      </div>

      <nav class="portal-nav" aria-label="主页面导航">
        <PortalNavTree
          :items="navigationMenus"
          :active-page="activePage"
          :active-keys="activeMenuKeys"
          @open="openMenu"
        />
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
            @click="emit('refreshHealth')"
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
