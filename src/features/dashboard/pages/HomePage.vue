<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock3,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-vue-next'
import type { MainPage, PortalMenuItem } from '../../../app/navigation'
import type { RecentVisit } from '../../../app/recentVisits'
import type { AuthUser, HealthResponse } from '../../../shared/api/types'

const props = defineProps<{
  currentUser: AuthUser
  menus: PortalMenuItem[]
  health: HealthResponse | null
  healthLoading: boolean
  healthError: string
  healthRefreshedAt: number | null
  recentVisits: RecentVisit[]
}>()

const emit = defineEmits<{
  openPage: [page: MainPage]
  refreshHome: []
}>()

interface HomeMenuEntry { // 首页可搜索的授权叶子菜单
  key: string
  label: string
  subLabel: string
  pageKey: MainPage
  icon: PortalMenuItem['icon']
}

interface RecentMenuEntry extends HomeMenuEntry { // 最近访问展示项，附带真实访问时间
  visitedAt: number
}

const menuKeyword = ref('')
const currentDate = ref(new Date())

const displayName = computed(() => (
  props.currentUser.display_name?.trim() || props.currentUser.username
))

const greeting = computed(() => {
  // 按当前小时显示简洁问候，不依赖后端业务数据。
  const hour = currentDate.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const dateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(currentDate.value))

const menuEntries = computed(() => flattenMenuEntries(props.menus))

const filteredMenuEntries = computed(() => {
  // 授权菜单搜索同时匹配主标题、副标题和页面键。
  const keyword = menuKeyword.value.trim().toLowerCase()
  if (!keyword) return menuEntries.value
  return menuEntries.value.filter((entry) => [
    entry.label,
    entry.subLabel,
    entry.pageKey,
  ].some((value) => value.toLowerCase().includes(keyword)))
})

const roleLabel = computed(() => {
  // 使用稳定的角色标签，未知角色保留后端原始值。
  const labels: Record<string, string> = {
    admin: '系统管理员',
    manager: '管理员',
    user: '普通用户',
  }
  return labels[props.currentUser.role] || props.currentUser.role || '未配置'
})

const healthTone = computed(() => {
  if (props.healthLoading) return 'loading'
  if (props.healthError) return 'warning'
  return props.health?.status === 'ok' ? 'healthy' : 'warning'
})

const healthLabel = computed(() => {
  if (props.healthLoading) return '检查中'
  if (props.healthError) return '状态未知'
  if (props.health?.status === 'ok') return '运行正常'
  if (props.health?.status === 'degraded') return '部分降级'
  return '未检查'
})

const refreshedAtLabel = computed(() => {
  if (!props.healthRefreshedAt) return '尚未刷新'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(props.healthRefreshedAt))
})

const recentMenuEntries = computed<RecentMenuEntry[]>(() => {
  // 最近访问只根据当前授权菜单补齐展示信息，菜单撤权后不会继续出现。
  const entryMap = new Map(menuEntries.value.map((entry) => [entry.pageKey, entry]))
  return props.recentVisits.flatMap((visit) => {
    const entry = entryMap.get(visit.pageKey)
    return entry ? [{ ...entry, visitedAt: visit.visitedAt }] : []
  })
})

function flattenMenuEntries(menus: PortalMenuItem[]): HomeMenuEntry[] { // 递归提取当前授权菜单中的可访问页面
  return menus.flatMap((menu) => [
    ...(menu.pageKey ? [{
      key: menu.key,
      label: menu.label,
      subLabel: menu.subLabel,
      pageKey: menu.pageKey,
      icon: menu.icon,
    }] : []),
    ...flattenMenuEntries(menu.children),
  ])
}

function openPage(pageKey: MainPage): void { // 从首页菜单或最近访问进入目标授权页面
  emit('openPage', pageKey)
}

function refreshHome(): void { // 同步当前日期时间，并请求 App 层刷新授权菜单和共享健康状态
  currentDate.value = new Date()
  emit('refreshHome')
}

function relativeVisitTime(visitedAt: number): string { // 将访问时间转成便于扫描的相对时间
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - visitedAt) / 1000))
  if (elapsedSeconds < 60) return '刚刚'
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} 小时前`
  const elapsedDays = Math.floor(elapsedHours / 24)
  return elapsedDays < 7
    ? `${elapsedDays} 天前`
    : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(visitedAt))
}
</script>

<template>
  <section class="neutral-home-page">
    <header class="home-welcome-band">
      <div class="home-welcome-copy">
        <span><CalendarDays :size="15" /> {{ dateLabel }}</span>
        <h2>{{ greeting }}，{{ displayName }}</h2>
        <p>知域 Nexus · 个人工作台</p>
      </div>
      <el-input
        v-model="menuKeyword"
        class="home-menu-search"
        clearable
        size="large"
        placeholder="搜索可访问页面"
        aria-label="搜索可访问页面"
      >
        <template #prefix><Search :size="17" /></template>
      </el-input>
    </header>

    <div class="home-metrics" aria-label="账户与系统状态">
      <article class="home-metric">
        <span class="tone-primary"><UserRound :size="18" /></span>
        <div><small>当前角色</small><strong>{{ roleLabel }}</strong></div>
      </article>
      <article class="home-metric">
        <span class="tone-cyan"><Menu :size="18" /></span>
        <div><small>可用菜单</small><strong>{{ menuEntries.length }}</strong></div>
      </article>
      <article class="home-metric">
        <span :class="`tone-${healthTone}`"><Activity :size="18" /></span>
        <div><small>服务状态</small><strong>{{ healthLabel }}</strong></div>
      </article>
      <article class="home-metric home-health-refresh">
        <span class="tone-muted"><Clock3 :size="18" /></span>
        <div><small>更新时间</small><strong>{{ refreshedAtLabel }}</strong></div>
        <button
          type="button"
          :disabled="healthLoading"
          title="刷新首页数据"
          aria-label="刷新首页数据"
          @click="refreshHome"
        >
          <RefreshCw :class="{ spin: healthLoading }" :size="15" />
        </button>
      </article>
    </div>

    <section class="home-section home-authorized-section">
      <div class="home-section-heading">
        <div>
          <span><ShieldCheck :size="15" /> 当前权限</span>
          <h3>授权菜单</h3>
        </div>
        <em>{{ filteredMenuEntries.length }} 项</em>
      </div>

      <div v-if="filteredMenuEntries.length" class="home-menu-grid">
        <button
          v-for="entry in filteredMenuEntries"
          :key="entry.key"
          class="home-menu-entry"
          type="button"
          @click="openPage(entry.pageKey)"
        >
          <span><component :is="entry.icon" :size="18" /></span>
          <div>
            <strong>{{ entry.label }}</strong>
            <small>{{ entry.subLabel || '授权页面' }}</small>
          </div>
          <ArrowRight :size="16" />
        </button>
      </div>
      <div v-else class="home-empty-state">
        <Search :size="22" />
        <strong>没有匹配的授权页面</strong>
        <span>请调整搜索条件</span>
      </div>
    </section>

    <section class="home-section home-recent-section">
      <div class="home-section-heading">
        <div>
          <span><Clock3 :size="15" /> 本账号</span>
          <h3>最近访问</h3>
        </div>
      </div>

      <div v-if="recentMenuEntries.length" class="home-recent-list">
        <button
          v-for="entry in recentMenuEntries"
          :key="entry.pageKey"
          type="button"
          @click="openPage(entry.pageKey)"
        >
          <span><component :is="entry.icon" :size="17" /></span>
          <div><strong>{{ entry.label }}</strong><small>{{ entry.subLabel || entry.pageKey }}</small></div>
          <time :datetime="new Date(entry.visitedAt).toISOString()">{{ relativeVisitTime(entry.visitedAt) }}</time>
          <ArrowRight :size="15" />
        </button>
      </div>
      <div v-else class="home-empty-state compact">
        <Clock3 :size="22" />
        <strong>暂无最近访问记录</strong>
        <span>打开授权页面后会显示在这里</span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.neutral-home-page {
  display: grid;
  gap: 18px;
  align-content: start;
  height: 100%;
  min-height: 0;
  padding: 4px 2px 28px;
  overflow-y: auto;
  color: var(--text);
}

.home-welcome-band {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 2px 18px;
  border-bottom: 1px solid var(--line);
}

.home-welcome-copy > span,
.home-section-heading span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.home-welcome-copy h2 {
  margin: 7px 0 0;
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: 0;
}

.home-welcome-copy p {
  margin: 7px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.home-menu-search {
  width: min(100%, 390px);
}

.home-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.home-metric {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 72px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.home-metric > span,
.home-menu-entry > span,
.home-recent-list button > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 7px;
  color: var(--text-soft);
  background: var(--surface-3);
}

.home-metric > div,
.home-menu-entry > div,
.home-recent-list button > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.home-metric small,
.home-menu-entry small,
.home-recent-list small,
.home-recent-list time {
  color: var(--text-muted);
  font-size: 11px;
}

.home-metric strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-metric .tone-primary {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 11%, var(--surface));
}

.home-metric .tone-cyan {
  color: var(--cyan);
  background: color-mix(in srgb, var(--cyan) 11%, var(--surface));
}

.home-metric .tone-healthy {
  color: var(--green);
  background: color-mix(in srgb, var(--green) 11%, var(--surface));
}

.home-metric .tone-warning {
  color: var(--amber);
  background: color-mix(in srgb, var(--amber) 12%, var(--surface));
}

.home-metric .tone-loading {
  color: var(--primary);
}

.home-health-refresh {
  grid-template-columns: 38px minmax(0, 1fr) 30px;
}

.home-health-refresh button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text-soft);
  background: var(--surface-2);
  cursor: pointer;
}

.home-health-refresh button:disabled {
  cursor: wait;
  opacity: .62;
}

.home-section {
  display: grid;
  gap: 12px;
  padding-top: 2px;
}

.home-section + .home-section {
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.home-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.home-section-heading > div {
  display: grid;
  gap: 4px;
}

.home-section-heading h3 {
  margin: 0;
  font-size: 17px;
  letter-spacing: 0;
}

.home-section-heading em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.home-menu-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.home-menu-entry,
.home-recent-list button {
  display: grid;
  gap: 10px;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text);
  text-align: left;
  background: var(--surface);
  cursor: pointer;
  transition: border-color .16s ease, background-color .16s ease, transform .16s ease;
}

.home-menu-entry {
  grid-template-columns: 38px minmax(0, 1fr) 18px;
  min-height: 72px;
  padding: 10px 12px;
}

.home-menu-entry:hover,
.home-recent-list button:hover {
  border-color: color-mix(in srgb, var(--primary) 42%, var(--line));
  background: color-mix(in srgb, var(--primary) 4%, var(--surface));
  transform: translateY(-1px);
}

.home-menu-entry strong,
.home-recent-list strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-recent-list {
  display: grid;
  border-top: 1px solid var(--line);
}

.home-recent-list button {
  grid-template-columns: 36px minmax(0, 1fr) auto 18px;
  min-height: 60px;
  padding: 9px 4px;
  border-width: 0 0 1px;
  border-radius: 0;
  background: transparent;
}

.home-recent-list button > span {
  width: 34px;
  height: 34px;
}

.home-empty-state {
  display: grid;
  justify-items: center;
  gap: 6px;
  min-height: 150px;
  padding: 28px;
  border: 1px dashed var(--line-strong);
  border-radius: 7px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface-2) 74%, transparent);
}

.home-empty-state.compact {
  min-height: 120px;
}

.home-empty-state strong {
  color: var(--text-soft);
  font-size: 13px;
}

.home-empty-state span {
  font-size: 12px;
}

@media (max-width: 1080px) {
  .home-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-menu-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .neutral-home-page {
    gap: 14px;
  }

  .home-welcome-band {
    align-items: stretch;
    flex-direction: column;
  }

  .home-menu-search {
    width: 100%;
  }

  .home-metrics,
  .home-menu-grid {
    grid-template-columns: 1fr;
  }

  .home-welcome-copy h2 {
    font-size: 23px;
  }

  .home-recent-list button {
    grid-template-columns: 34px minmax(0, 1fr) 16px;
  }

  .home-recent-list time {
    display: none;
  }
}
</style>
