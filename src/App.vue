<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppShell from './app/AppShell.vue'
import LoginGate from './app/LoginGate.vue'
import { buildPortalMenus, type MainPage, type PortalMenuItem, type ThemeMode } from './app/navigation'
import { collectAllowedPagesFromPortalMenus, collectAllowedPagesFromSystemMenus, resolveAccessiblePage } from './app/routeGuard'
import {
  clearAccessToken,
  listCurrentUserMenus,
  login,
  logoutCurrentUser,
  refreshAccessToken,
  AUTH_EXPIRED_EVENT,
  type AuthUser,
  type SystemMenuResponse,
} from './shared/api'

const HomePage = defineAsyncComponent(() => import('./features/dashboard/pages/HomePage.vue'))
const ChatPage = defineAsyncComponent(() => import('./features/chat/pages/ChatPage.vue'))
const SalesTrainingPage = defineAsyncComponent(() => import('./features/sales-training/pages/SalesTrainingPage.vue'))
const ExamPage = defineAsyncComponent(() => import('./features/exam/pages/ExamPage.vue'))
const UserManagementPage = defineAsyncComponent(() => import('./features/system/pages/UserManagementPage.vue'))
const RoleManagementPage = defineAsyncComponent(() => import('./features/system/pages/RoleManagementPage.vue'))
const MenuManagementPage = defineAsyncComponent(() => import('./features/system/pages/MenuManagementPage.vue'))

const themeMode = ref<ThemeMode>(readInitialThemeMode())
const activePage = ref<MainPage>('home')
const chatHistoryRequest = ref<{ token: number; conversationId: string } | null>(null)
const authRestoring = ref(true)
const authLoading = ref(false)
const authError = ref('')
const currentUser = ref<AuthUser | null>(null)
const portalMenus = ref<PortalMenuItem[]>([])
const allowedPages = computed(() => collectAllowedPagesFromPortalMenus(portalMenus.value))
const hasActivePageAccess = computed(() => allowedPages.value.has(activePage.value))
const loginForm = reactive({
  username: '',
  password: '',
})
const loginSubmitDisabled = computed(() => (
  authLoading.value || !loginForm.username.trim() || !loginForm.password.trim()
))

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
    await loadPortalMenus()
  } catch {
    // 没有 refresh cookie 时进入登录页，这是首次打开系统的正常路径。
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
    await loadPortalMenus()
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
    // 后端退出失败时也要清空前端 token，避免页面误以为仍然登录。
    clearAccessToken()
    ElMessage.warning(error instanceof Error ? error.message : '退出登录请求失败，已清理本地登录态')
  } finally {
    currentUser.value = null
    portalMenus.value = []
    activePage.value = 'home'
    authLoading.value = false
  }
}

function handleAuthExpired() {
  if (!currentUser.value) return
  clearAccessToken()
  currentUser.value = null
  portalMenus.value = []
  activePage.value = 'home'
  authError.value = '登录状态已过期，请重新登录'
  ElMessage.warning('登录状态已过期，请重新登录')
}

async function loadPortalMenus() {
  try {
    const menus = await listCurrentUserMenus()
    portalMenus.value = buildPortalMenus(menus)
    syncActivePageWithMenus(menus)
  } catch (error) {
    portalMenus.value = []
    ElMessage.warning(error instanceof Error ? error.message : '菜单读取失败')
  }
}

function syncActivePageWithMenus(menus: SystemMenuResponse[]) {
  // 后端菜单不包含当前页面时切回首页，避免用户留在无权限页面。
  activePage.value = resolveAccessiblePage(activePage.value, collectAllowedPagesFromSystemMenus(menus))
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
  <LoginGate
    v-if="authRestoring || !currentUser"
    v-model:theme-mode="themeMode"
    v-model:username="loginForm.username"
    v-model:password="loginForm.password"
    :auth-restoring="authRestoring"
    :auth-loading="authLoading"
    :auth-error="authError"
    :submit-disabled="loginSubmitDisabled"
    @login="handleLogin"
  />

  <AppShell
    v-else
    v-model:theme-mode="themeMode"
    v-model:active-page="activePage"
    :auth-loading="authLoading"
    :current-user="currentUser"
    :menus="portalMenus"
    @logout="handleLogout"
  >
    <div v-if="!hasActivePageAccess" class="page-empty-state">
      <strong>暂无可访问页面</strong>
      <span>请联系管理员配置菜单权限</span>
    </div>
    <HomePage
      v-else-if="activePage === 'home'"
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
    <ExamPage v-else-if="activePage === 'exam'" :theme-mode="themeMode" />
    <UserManagementPage v-else-if="activePage === 'userManagement'" :current-user="currentUser" />
    <RoleManagementPage v-else-if="activePage === 'roleManagement'" />
    <MenuManagementPage v-else-if="activePage === 'menuManagement'" />
    <div v-else class="page-empty-state">
      <strong>页面不可访问</strong>
      <span>当前页面没有匹配的后端菜单</span>
    </div>
  </AppShell>
</template>


