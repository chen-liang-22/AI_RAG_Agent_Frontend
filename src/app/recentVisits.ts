import type { MainPage } from './navigation'

export interface RecentVisit { // 最近访问只持久化页面键和访问时间，不保存菜单展示快照
  pageKey: MainPage
  visitedAt: number
}

const STORAGE_PREFIX = 'ai-rag-agent-recent-visits'
export const MAX_RECENT_VISITS = 5

function storageKey(userId: string): string { // 为每个用户生成独立的最近访问存储键
  return `${STORAGE_PREFIX}:${userId}`
}

function isRecentVisit(value: unknown): value is RecentVisit { // 校验本地存储中的单条最近访问结构
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RecentVisit>
  return typeof candidate.pageKey === 'string'
    && typeof candidate.visitedAt === 'number'
    && Number.isFinite(candidate.visitedAt)
}

export function loadRecentVisits(
  userId: string,
  allowedPages: Set<MainPage>,
): RecentVisit[] { // 读取当前用户最近访问，并按最新授权菜单过滤
  if (typeof window === 'undefined' || !userId) return []
  try {
    const rawValue = window.localStorage.getItem(storageKey(userId))
    if (!rawValue) return []
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isRecentVisit)
      .filter((visit) => allowedPages.has(visit.pageKey))
      .sort((left, right) => right.visitedAt - left.visitedAt)
      .slice(0, MAX_RECENT_VISITS)
  } catch {
    return []
  }
}

export function recordRecentVisit(
  userId: string,
  pageKey: MainPage,
  allowedPages: Set<MainPage>,
  visitedAt = Date.now(),
): RecentVisit[] { // 记录一次真实页面访问，同一页面只保留最新时间
  if (typeof window === 'undefined' || !userId || !allowedPages.has(pageKey)) return []
  const nextVisits = [
    { pageKey, visitedAt },
    ...loadRecentVisits(userId, allowedPages).filter((visit) => visit.pageKey !== pageKey),
  ].slice(0, MAX_RECENT_VISITS)
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(nextVisits))
  } catch {
    // 隐私模式或存储空间不可用时保留内存结果，不阻断页面导航。
  }
  return nextVisits
}
