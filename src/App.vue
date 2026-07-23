<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppShell from './app/AppShell.vue'
import LoginGate from './app/LoginGate.vue'
import {
  buildPortalMenus,
  findPageByRoutePath,
  findRoutePathByPage,
  normalizeRoutePath,
  prepareSystemMenusForUser,
  type MainPage,
  type PortalMenuItem,
  type ThemeMode,
} from './app/navigation'
import {
  collectAllowedPagesFromPortalMenus,
  resolveAccessiblePage,
} from './app/routeGuard'
import {
  loadRecentVisits,
  recordRecentVisit,
  type RecentVisit,
} from './app/recentVisits'
import {
  AUTH_EXPIRED_EVENT,
  clearAccessToken,
  fetchHealth,
  listCurrentUserMenus,
  login,
  logoutCurrentUser,
  refreshAccessToken,
  type AuthUser,
  type HealthResponse,
} from './shared/api'

const HomePage = defineAsyncComponent(() => import('./features/dashboard/pages/HomePage.vue'))
const ChatPage = defineAsyncComponent(() => import('./features/chat/pages/ChatPage.vue'))
const KnowledgeManagementPage = defineAsyncComponent(
  () => import('./features/knowledge/pages/KnowledgeManagementPage.vue'),
)
const SalesTrainingPage = defineAsyncComponent(() => import('./features/sales-training/pages/SalesTrainingPage.vue'))
const KnowledgeGraphPage = defineAsyncComponent(() => import('./features/knowledge-graph/pages/KnowledgeGraphPage.vue'))
const ExamPage = defineAsyncComponent(() => import('./features/exam/pages/ExamPage.vue'))
const UserManagementPage = defineAsyncComponent(() => import('./features/system/pages/UserManagementPage.vue'))
const RoleManagementPage = defineAsyncComponent(() => import('./features/system/pages/RoleManagementPage.vue'))
const MenuManagementPage = defineAsyncComponent(() => import('./features/system/pages/MenuManagementPage.vue'))
const PromptManagementPage = defineAsyncComponent(() => import('./features/system/pages/PromptManagementPage.vue'))
const DictionaryManagementPage = defineAsyncComponent(
  () => import('./features/system/pages/DictionaryManagementPage.vue'),
)

const themeMode = ref<ThemeMode>(readInitialThemeMode())
const activePage = ref<MainPage>('home')
const salesTrainingInitialWorkspaceTab = ref<'setup' | 'knowledge'>('setup')
const authRestoring = ref(true)
const authLoading = ref(false)
const authError = ref('')
const currentUser = ref<AuthUser | null>(null)
const portalMenus = ref<PortalMenuItem[]>([])
const health = ref<HealthResponse | null>(null)
const healthLoading = ref(false)
const healthError = ref('')
const healthRefreshedAt = ref<number | null>(null)
const recentVisits = ref<RecentVisit[]>([])
const allowedPages = computed(() => collectAllowedPagesFromPortalMenus(portalMenus.value))
const hasActivePageAccess = computed(() => allowedPages.value.has(activePage.value))
const loginForm = reactive({
  username: '',
  password: '',
})
const loginSubmitDisabled = computed(() => (
  authLoading.value || !loginForm.username.trim() || !loginForm.password.trim()
))

function readInitialThemeMode(): ThemeMode { // 从本地存储恢复主题，服务端渲染环境默认深色
  if (typeof window === 'undefined') return 'dark'
  const savedTheme = window.localStorage.getItem('ai-rag-agent-theme')
  return savedTheme === 'light' ? 'light' : 'dark'
}

function refreshRecentVisitState(): void { // 按当前用户和最新菜单权限读取最近访问
  if (!currentUser.value) {
    recentVisits.value = []
    return
  }
  recentVisits.value = loadRecentVisits(currentUser.value.user_id, allowedPages.value)
}

function pagePath(page: MainPage): string | undefined { // 从授权菜单中读取页面路径，首页缺少配置时回退根路径
  return findRoutePathByPage(portalMenus.value, page) || (page === 'home' ? '/' : undefined)
}

function writeBrowserPath(page: MainPage, mode: 'push' | 'replace'): void { // 使用原生 History API 同步当前页面路径
  const nextPath = pagePath(page)
  if (!nextPath) return
  const currentPath = normalizeRoutePath(window.location.pathname) || '/'
  if (mode === 'push' && currentPath === nextPath) return
  if (mode === 'push') {
    window.history.pushState({ pageKey: page }, '', nextPath)
    return
  }
  window.history.replaceState({ pageKey: page }, '', nextPath)
}

function saveRecentVisit(page: MainPage): void { // 记录用户真实进入的非首页页面
  if (!currentUser.value || page === 'home') {
    refreshRecentVisitState()
    return
  }
  recentVisits.value = recordRecentVisit(
    currentUser.value.user_id,
    page,
    allowedPages.value,
  )
}

function activatePage(
  requestedPage: MainPage,
  historyMode: 'push' | 'replace' | 'none',
  recordVisit = true,
): void { // 在权限范围内切换 activePage，并按场景写入浏览器历史
  const nextPage = allowedPages.value.has(requestedPage)
    ? requestedPage
    : resolveAccessiblePage('home', allowedPages.value)
  activePage.value = nextPage
  if (historyMode !== 'none') writeBrowserPath(nextPage, historyMode)
  if (recordVisit) saveRecentVisit(nextPage)
}

function restorePageFromLocation(): void { // 登录恢复、刷新和菜单加载后按当前 URL 恢复授权页面
  const pathPage = findPageByRoutePath(portalMenus.value, window.location.pathname)
  if (pathPage && allowedPages.value.has(pathPage)) {
    activatePage(pathPage, 'none')
    return
  }
  activatePage(resolveAccessiblePage('home', allowedPages.value), 'replace', false)
}

function handlePageNavigation(page: MainPage): void { // 处理侧栏、首页搜索和最近访问发起的页面导航
  if (page === 'salesTraining') salesTrainingInitialWorkspaceTab.value = 'setup'
  activatePage(page, allowedPages.value.has(page) ? 'push' : 'replace')
}

function handleSalesTrainingKnowledgeNavigation(): void { // 从全局知识库进入销售训练资料管理
  if (!allowedPages.value.has('salesTraining')) {
    ElMessage.warning('当前账号没有销售陪练访问权限')
    return
  }
  salesTrainingInitialWorkspaceTab.value = 'knowledge'
  activatePage('salesTraining', 'push')
}

async function refreshHealth(): Promise<void> { // 在应用层统一刷新健康状态，供顶栏和首页复用
  if (healthLoading.value) return
  healthLoading.value = true
  healthError.value = ''
  try {
    health.value = await fetchHealth()
  } catch (error) {
    health.value = null
    healthError.value = error instanceof Error ? error.message : '健康检查失败'
  } finally {
    healthRefreshedAt.value = Date.now()
    healthLoading.value = false
  }
}

async function refreshHome(): Promise<void> { // 首页刷新时并发更新授权菜单与共享健康状态
  await Promise.all([loadPortalMenus(), refreshHealth()])
}

async function restoreLogin(): Promise<void> { // 使用刷新令牌恢复登录，并在菜单加载后恢复深层路径
  authRestoring.value = true
  authError.value = ''
  try {
    const response = await refreshAccessToken()
    currentUser.value = response.user
    await loadPortalMenus()
  } catch {
    // 没有 refresh cookie 时保留当前深层路径，登录成功后继续恢复。
    clearAccessToken()
    currentUser.value = null
  } finally {
    authRestoring.value = false
  }
}

async function handleLogin(): Promise<void> { // 提交登录表单并加载当前用户授权菜单
  if (loginSubmitDisabled.value) return
  authLoading.value = true
  authError.value = ''
  try {
    const response = await login({
      username: loginForm.username.trim(),
      password: loginForm.password,
    })
    currentUser.value = response.user
    await loadPortalMenus()
    ElMessage.success(`欢迎回来，${response.user.display_name || response.user.username}`)
  } catch (error) {
    authError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    authLoading.value = false
  }
}

async function handleLogout(): Promise<void> { // 退出登录并清理当前用户的内存状态
  if (authLoading.value) return
  authLoading.value = true
  try {
    await logoutCurrentUser()
    ElMessage.success('已退出登录')
  } catch (error) {
    clearAccessToken()
    ElMessage.warning(error instanceof Error ? error.message : '退出登录请求失败，已清理本地登录态')
  } finally {
    currentUser.value = null
    portalMenus.value = []
    recentVisits.value = []
    activePage.value = 'home'
    window.history.replaceState({ pageKey: 'home' }, '', '/')
    authLoading.value = false
  }
}

function handleAuthExpired(): void { // 访问令牌和刷新令牌都失效时回到登录门禁
  if (!currentUser.value) return
  clearAccessToken()
  currentUser.value = null
  portalMenus.value = []
  recentVisits.value = []
  activePage.value = 'home'
  authError.value = '登录状态已过期，请重新登录'
  ElMessage.warning('登录状态已过期，请重新登录')
}

async function loadPortalMenus(): Promise<void> { // 加载并转换后端菜单，再按当前浏览器路径恢复页面
  try {
    const menus = await listCurrentUserMenus()
    const preparedMenus = prepareSystemMenusForUser(menus, currentUser.value?.role)
    portalMenus.value = buildPortalMenus(preparedMenus)
    restorePageFromLocation()
    refreshRecentVisitState()
  } catch (error) {
    portalMenus.value = []
    recentVisits.value = []
    activePage.value = 'home'
    window.history.replaceState({ pageKey: 'home' }, '', '/')
    ElMessage.warning(error instanceof Error ? error.message : '菜单读取失败')
  }
}

function handleForbiddenPage(page: MainPage): void { // 页面接口返回 403 时移除当前页并回退到授权首页
  const fallbackPages = new Set(allowedPages.value)
  fallbackPages.delete(page)
  const fallbackPage = resolveAccessiblePage('home', fallbackPages)
  activePage.value = fallbackPage
  writeBrowserPath(fallbackPage, 'replace')
  refreshRecentVisitState()
}

function handlePromptForbidden(): void { // 提示词页面拒绝访问时回退
  handleForbiddenPage('promptManagement')
}

function handleDictionaryForbidden(): void { // 字典页自校验或接口拒绝访问时回退
  handleForbiddenPage('dictionaryManagement')
}

function handlePopState(): void { // 浏览器前进后退时只恢复授权页面，不创建新的历史记录
  if (!currentUser.value) return
  const pathPage = findPageByRoutePath(portalMenus.value, window.location.pathname)
  if (pathPage && allowedPages.value.has(pathPage)) {
    activatePage(pathPage, 'none')
    return
  }
  activatePage(resolveAccessiblePage('home', allowedPages.value), 'replace', false)
}

watch(themeMode, (nextTheme) => {
  // 主题变化同步到本地存储和根节点，异步页面可直接复用 CSS 变量。
  window.localStorage.setItem('ai-rag-agent-theme', nextTheme)
  document.documentElement.dataset.theme = nextTheme
})

onMounted(() => {
  document.documentElement.dataset.theme = themeMode.value
  window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  window.addEventListener('popstate', handlePopState)
  void refreshHealth()
  void restoreLogin()
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  window.removeEventListener('popstate', handlePopState)
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
    :health="health"
    :health-loading="healthLoading"
    :health-error="healthError"
    @navigate="handlePageNavigation"
    @refresh-health="refreshHealth"
    @logout="handleLogout"
  >
    <div v-if="!hasActivePageAccess" class="page-empty-state">
      <strong>暂无可访问页面</strong>
      <span>请联系管理员配置菜单权限</span>
    </div>
    <HomePage
      v-else-if="activePage === 'home'"
      :current-user="currentUser"
      :menus="portalMenus"
      :health="health"
      :health-loading="healthLoading"
      :health-error="healthError"
      :health-refreshed-at="healthRefreshedAt"
      :recent-visits="recentVisits"
      @open-page="handlePageNavigation"
      @refresh-home="refreshHome"
    />
    <ChatPage
      v-else-if="activePage === 'chat'"
      :theme-mode="themeMode"
      :current-user="currentUser"
    />
    <KnowledgeManagementPage
      v-else-if="activePage === 'knowledgeManagement'"
      :theme-mode="themeMode"
      @open-sales-training-knowledge="handleSalesTrainingKnowledgeNavigation"
    />
    <SalesTrainingPage
      v-else-if="activePage === 'salesTraining'"
      :theme-mode="themeMode"
      :initial-workspace-tab="salesTrainingInitialWorkspaceTab"
    />
    <KnowledgeGraphPage v-else-if="activePage === 'knowledgeGraph'" :theme-mode="themeMode" />
    <ExamPage v-else-if="activePage === 'exam'" :theme-mode="themeMode" />
    <UserManagementPage v-else-if="activePage === 'userManagement'" :current-user="currentUser" />
    <RoleManagementPage v-else-if="activePage === 'roleManagement'" />
    <MenuManagementPage v-else-if="activePage === 'menuManagement'" />
    <PromptManagementPage
      v-else-if="activePage === 'promptManagement'"
      :current-user="currentUser"
      @forbidden="handlePromptForbidden"
    />
    <DictionaryManagementPage
      v-else-if="activePage === 'dictionaryManagement'"
      :current-user="currentUser"
      @forbidden="handleDictionaryForbidden"
    />
    <div v-else class="page-empty-state">
      <strong>页面不可访问</strong>
      <span>当前页面没有匹配的后端菜单</span>
    </div>
  </AppShell>
</template>
