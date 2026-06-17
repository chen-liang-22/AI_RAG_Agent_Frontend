<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Bot, ClipboardCheck, LayoutDashboard, Moon, Sparkles, Sun } from 'lucide-vue-next'
import ChatPage from './pages/ChatPage.vue'
import ExamPage from './pages/ExamPage.vue'
import HomePage from './pages/HomePage.vue'

type ThemeMode = 'dark' | 'light'
type MainPage = 'home' | 'chat' | 'exam'

const themeMode = ref<ThemeMode>(readInitialThemeMode())
const activePage = ref<MainPage>('home')
const themeToggleIcon = computed(() => (themeMode.value === 'dark' ? Sun : Moon))

const pages = [
  { key: 'home' as const, label: '首页', subLabel: '系统驾驶舱', icon: LayoutDashboard },
  { key: 'chat' as const, label: '智能客服', subLabel: 'RAG 问答', icon: Bot },
  { key: 'exam' as const, label: '问答考试', subLabel: '知识测评', icon: ClipboardCheck },
]

function readInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const savedTheme = window.localStorage.getItem('ai-rag-agent-theme')
  return savedTheme === 'light' ? 'light' : 'dark'
}

watch(themeMode, (nextTheme) => {
  window.localStorage.setItem('ai-rag-agent-theme', nextTheme)
  document.documentElement.dataset.theme = nextTheme
})

onMounted(() => {
  document.documentElement.dataset.theme = themeMode.value
})
</script>

<template>
  <main class="portal-shell" :class="`theme-${themeMode}`">
    <aside class="portal-sidebar">
      <div class="portal-brand">
        <span class="portal-brand-mark"><Sparkles :size="22" /></span>
        <div>
          <h1>AI RAG Agent</h1>
          <p>知识中枢工作台</p>
        </div>
      </div>

      <nav class="portal-nav" aria-label="主页面导航">
        <button
          v-for="page in pages"
          :key="page.key"
          class="portal-nav-item"
          :class="{ active: activePage === page.key }"
          type="button"
          @click="activePage = page.key"
        >
          <span><component :is="page.icon" :size="18" /></span>
          <strong>{{ page.label }}</strong>
          <em>{{ page.subLabel }}</em>
        </button>
      </nav>

      <button class="portal-theme-button" type="button" @click="themeMode = themeMode === 'dark' ? 'light' : 'dark'">
        <component :is="themeToggleIcon" :size="18" />
        <span>{{ themeMode === 'dark' ? '切换浅色' : '切换深色' }}</span>
      </button>
    </aside>

    <section class="portal-content" :class="`page-${activePage}`">
      <HomePage v-if="activePage === 'home'" :theme-mode="themeMode" />
      <ChatPage v-else-if="activePage === 'chat'" :theme-mode="themeMode" />
      <ExamPage v-else :theme-mode="themeMode" />
    </section>
  </main>
</template>
