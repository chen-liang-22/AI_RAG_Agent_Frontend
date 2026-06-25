<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Bot,
  BrainCircuit,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
} from 'lucide-vue-next'
import {
  AUTH_EXPIRED_EVENT,
  clearAccessToken,
  login,
  logoutCurrentUser,
  refreshAccessToken,
  type AuthUser,
} from './api'
import ChatPage from './pages/ChatPage.vue'
import ExamPage from './pages/ExamPage.vue'
import HomePage from './pages/HomePage.vue'
import SalesTrainingPage from './pages/SalesTrainingPage.vue'

type ThemeMode = 'dark' | 'light'
type MainPage = 'home' | 'chat' | 'exam' | 'salesTraining'

const themeMode = ref<ThemeMode>(readInitialThemeMode())
const activePage = ref<MainPage>('home')
const chatHistoryRequest = ref<{ token: number; conversationId: string } | null>(null)
const authRestoring = ref(true)
const authLoading = ref(false)
const authError = ref('')
const currentUser = ref<AuthUser | null>(null)
const loginForm = reactive({
  username: 'admin',
  password: '1234qwer',
})
const themeToggleIcon = computed(() => (themeMode.value === 'dark' ? Sun : Moon))
const loginSubmitDisabled = computed(() => (
  authLoading.value || !loginForm.username.trim() || !loginForm.password.trim()
))
const currentUserInitial = computed(() => {
  const displayName = currentUser.value?.display_name || currentUser.value?.username || 'U'
  return displayName.slice(0, 1).toUpperCase()
})
const currentUserRoleLabel = computed(() => {
  if (!currentUser.value) return '未登录'
  return currentUser.value.role === 'admin' ? '管理员' : currentUser.value.role
})

const pages = [
  { key: 'home' as const, label: '首页', subLabel: '系统驾驶舱', icon: LayoutDashboard },
  { key: 'chat' as const, label: '智能客服', subLabel: 'RAG 问答', icon: Bot },
  { key: 'salesTraining' as const, label: '销售陪练', subLabel: 'AI 客户训练', icon: BrainCircuit },
  { key: 'exam' as const, label: '问答考试', subLabel: '知识测评', icon: ClipboardCheck },
]

function readInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const savedTheme = window.localStorage.getItem('ai-rag-agent-theme')
  return savedTheme === 'light' ? 'light' : 'dark'
}

function openChatHistory(conversationId: string) {
  activePage.value = 'chat'
  chatHistoryRequest.value = { token: Date.now(), conversationId }
}

function openSalesTraining() {
  activePage.value = 'salesTraining'
}

async function restoreLogin() {
  authRestoring.value = true
  authError.value = ''
  try {
    const response = await refreshAccessToken()
    currentUser.value = response.user
  } catch {
    // 第一次打开页面没有 refresh cookie 是正常情况，直接展示登录页即可。
    clearAccessToken()
    currentUser.value = null
  } finally {
    authRestoring.value = false
  }
}

async function handleLogin() {
  if (loginSubmitDisabled.value) return

  authLoading.value = true
  authError.value = ''
  try {
    const response = await login({
      username: loginForm.username.trim(),
      password: loginForm.password,
    })
    currentUser.value = response.user
    activePage.value = 'home'
    ElMessage.success(`欢迎回来，${response.user.display_name || response.user.username}`)
  } catch (error) {
    authError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    authLoading.value = false
  }
}

async function handleLogout() {
  if (authLoading.value) return

  authLoading.value = true
  try {
    await logoutCurrentUser()
    ElMessage.success('已退出登录')
  } catch (error) {
    // 即使后端退出请求失败，也要清理前端内存 token，避免页面继续误判为已登录。
    clearAccessToken()
    ElMessage.warning(error instanceof Error ? error.message : '退出登录请求失败，已清理本地登录态')
  } finally {
    currentUser.value = null
    activePage.value = 'home'
    authLoading.value = false
  }
}

function handleAuthExpired() {
  if (!currentUser.value) return
  clearAccessToken()
  currentUser.value = null
  activePage.value = 'home'
  authError.value = '登录状态已过期，请重新登录'
  ElMessage.warning('登录状态已过期，请重新登录')
}

watch(themeMode, (nextTheme) => {
  window.localStorage.setItem('ai-rag-agent-theme', nextTheme)
  document.documentElement.dataset.theme = nextTheme
})

onMounted(() => {
  document.documentElement.dataset.theme = themeMode.value
  window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  void restoreLogin()
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
})
</script>

<template>
  <main v-if="authRestoring || !currentUser" class="login-gate" :class="`theme-${themeMode}`">
    <button class="login-theme-button" type="button" @click="themeMode = themeMode === 'dark' ? 'light' : 'dark'">
      <component :is="themeToggleIcon" :size="18" />
      <span>{{ themeMode === 'dark' ? '浅色模式' : '深色模式' }}</span>
    </button>

    <section class="login-card" aria-label="系统登录">
      <div class="login-brand">
        <span class="login-mark"><ShieldCheck :size="26" /></span>
        <div>
          <strong>知习台安全入口</strong>
          <p>AI RAG Agent · 训练与知识工作台</p>
        </div>
      </div>

      <div class="login-copy">
        <span>身份认证</span>
        <h1>进入智能知识中枢</h1>
        <p>登录后可访问智能客服、知识库管理、销售陪练和问答考试。</p>
      </div>

      <div v-if="authRestoring" class="login-restoring">
        <LoaderCircle class="spin" :size="28" />
        <span>正在恢复登录状态...</span>
      </div>

      <form v-else class="login-form" @submit.prevent="handleLogin">
        <label class="login-field">
          <span><UserRound :size="16" /> 登录账号</span>
          <input v-model="loginForm.username" autocomplete="username" placeholder="请输入账号" type="text" />
        </label>

        <label class="login-field">
          <span><KeyRound :size="16" /> 登录密码</span>
          <input
            v-model="loginForm.password"
            autocomplete="current-password"
            placeholder="请输入密码"
            type="password"
          />
        </label>

        <p v-if="authError" class="login-error">{{ authError }}</p>

        <button class="login-submit" :disabled="loginSubmitDisabled" type="submit">
          <LoaderCircle v-if="authLoading" class="spin" :size="18" />
          <LogIn v-else :size="18" />
          <span>{{ authLoading ? '正在校验' : '进入系统' }}</span>
        </button>
      </form>
    </section>

    <aside class="login-status-panel">
      <div>
        <strong>访问令牌</strong>
        <span>JWT · 30 分钟</span>
      </div>
      <div>
        <strong>续签会话</strong>
        <span>HttpOnly Cookie · Redis · 7 天</span>
      </div>
      <div>
        <strong>默认账号</strong>
        <span>admin / 1234qwer</span>
      </div>
    </aside>
  </main>

  <main v-else class="portal-shell" :class="`theme-${themeMode}`">
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

      <div class="portal-user-card">
        <span class="portal-user-avatar">{{ currentUserInitial }}</span>
        <div>
          <strong>{{ currentUser.display_name || currentUser.username }}</strong>
          <em>{{ currentUser.username }} · {{ currentUserRoleLabel }}</em>
        </div>
      </div>

      <button class="portal-logout-button" type="button" :disabled="authLoading" @click="handleLogout">
        <LoaderCircle v-if="authLoading" class="spin" :size="18" />
        <LogOut v-else :size="18" />
        <span>退出登录</span>
      </button>

      <button class="portal-theme-button" type="button" @click="themeMode = themeMode === 'dark' ? 'light' : 'dark'">
        <component :is="themeToggleIcon" :size="18" />
        <span>{{ themeMode === 'dark' ? '切换浅色' : '切换深色' }}</span>
      </button>
    </aside>

    <section class="portal-content" :class="`page-${activePage}`">
      <HomePage
        v-if="activePage === 'home'"
        :theme-mode="themeMode"
        @open-chat-history="openChatHistory"
        @open-sales-training="openSalesTraining"
      />
      <ChatPage
        v-else-if="activePage === 'chat'"
        :theme-mode="themeMode"
        :history-request="chatHistoryRequest"
        :current-user="currentUser"
      />
      <SalesTrainingPage v-else-if="activePage === 'salesTraining'" :theme-mode="themeMode" />
      <ExamPage v-else :theme-mode="themeMode" />
    </section>
  </main>
</template>
