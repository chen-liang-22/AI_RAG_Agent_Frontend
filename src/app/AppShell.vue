<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle, LogOut, Moon, Sparkles, Sun } from 'lucide-vue-next'
import type { AuthUser } from '../shared/api'
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
const currentUserInitial = computed(() => {
  const displayName = props.currentUser.display_name || props.currentUser.username || 'U'
  return displayName.slice(0, 1).toUpperCase()
})
function toggleTheme() {
  emit('update:themeMode', props.themeMode === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <main class="portal-shell" :class="`theme-${themeMode}`">
    <aside class="portal-sidebar">
      <div class="portal-brand">
        <span class="portal-brand-mark"><Sparkles :size="22" /></span>
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
          <span><component :is="page.icon" :size="18" /></span>
          <strong>{{ page.label }}</strong>
          <em>{{ page.subLabel }}</em>
        </button>
      </nav>

    </aside>

    <section class="portal-content" :class="`page-${activePage}`">
      <div class="portal-topbar">
        <div class="portal-account-panel" aria-label="账户操作">
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
            <LoaderCircle v-if="authLoading" class="spin" :size="18" />
            <LogOut v-else :size="18" />
          </button>

          <button
            class="portal-icon-button portal-theme-button"
            type="button"
            :title="themeMode === 'dark' ? '浅色模式' : '深色模式'"
            :aria-label="themeMode === 'dark' ? '浅色模式' : '深色模式'"
            @click="toggleTheme"
          >
            <component :is="themeToggleIcon" :size="18" />
          </button>
        </div>
      </div>

      <div class="portal-page-body">
        <slot />
      </div>
    </section>
  </main>
</template>
