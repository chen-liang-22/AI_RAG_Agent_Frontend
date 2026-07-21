import {
  Bot,
  BookKey,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Network,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { SystemMenuResponse } from '../shared/api'

export type ThemeMode = 'dark' | 'light'
export type MainPage =
  | 'home'
  | 'chat'
  | 'exam'
  | 'salesTraining'
  | 'knowledgeGraph'
  | 'userManagement'
  | 'roleManagement'
  | 'menuManagement'
  | 'promptManagement'
  | 'dictionaryManagement'

export interface PortalMenuItem { // 左侧菜单渲染项，只来源于后端菜单接口
  key: string
  label: string
  subLabel: string
  icon: Component
  pageKey?: MainPage
  routePath?: string
  children: PortalMenuItem[]
}

const iconMap: Record<string, Component> = {
  Bot,
  BookKey,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Network,
  Settings,
  ShieldCheck,
  Users,
}

export function isMainPage(value: string | null | undefined): value is MainPage {
  // 后端 page_key 只有命中本地页面映射时才允许切换，避免进入空白页。
  return [
    'home',
    'chat',
    'exam',
    'salesTraining',
    'knowledgeGraph',
    'userManagement',
    'roleManagement',
    'menuManagement',
    'promptManagement',
    'dictionaryManagement',
  ].includes(String(value || ''))
}

export function normalizeRoutePath(routePath: string | null | undefined): string | undefined {
  // 统一后端菜单路径，去掉查询串和末尾斜杠，保证刷新与菜单点击能稳定匹配。
  const source = String(routePath || '').trim()
  if (!source) return undefined
  const pathname = source.split(/[?#]/, 1)[0] || '/'
  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, '') : '/'
}

export function findPageByRoutePath(
  menus: PortalMenuItem[],
  pathname: string,
): MainPage | undefined {
  // 只在当前授权菜单树中解析路径，未授权的静态路径不能反推出页面。
  const normalizedPath = normalizeRoutePath(pathname)
  for (const item of menus) {
    if (item.pageKey && item.routePath === normalizedPath) return item.pageKey
    const nestedPage = findPageByRoutePath(item.children, pathname)
    if (nestedPage) return nestedPage
  }
  return undefined
}

export function findRoutePathByPage(
  menus: PortalMenuItem[],
  pageKey: MainPage,
): string | undefined {
  // 从授权菜单反查页面路径，避免维护独立的本地路由表。
  for (const item of menus) {
    if (item.pageKey === pageKey && item.routePath) return item.routePath
    const nestedPath = findRoutePathByPage(item.children, pageKey)
    if (nestedPath) return nestedPath
  }
  return undefined
}

export function prepareSystemMenusForUser(menus: SystemMenuResponse[], role?: string): SystemMenuResponse[] {
  // 非管理员移除管理员专属入口；管理员缺少提示词菜单时在系统管理下补充本地入口。
  const preparedMenus = filterPromptMenuByRole(menus, role === 'admin')
  if (role !== 'admin' || containsPromptMenu(preparedMenus)) return preparedMenus

  const systemMenu = findSystemMenu(preparedMenus)
  if (systemMenu) {
    systemMenu.children.push(createPromptMenu(systemMenu.menu_id))
    return preparedMenus
  }

  preparedMenus.push(createSystemMenuWithPrompt())
  return preparedMenus
}

function filterPromptMenuByRole(menus: SystemMenuResponse[], isAdmin: boolean): SystemMenuResponse[] {
  // 克隆菜单树并过滤管理员专属页面，避免本地权限处理修改后端响应对象。
  return menus
    .filter((menu) => isAdmin || (!isPromptMenu(menu) && !isDictionaryMenu(menu)))
    .map((menu) => ({
      ...menu,
      metadata: isPromptMenu(menu) && menu.metadata?.sub_label === '在线版本与热更新'
        ? { ...(menu.metadata || {}), sub_label: '提示词配置' }
        : menu.metadata,
      children: filterPromptMenuByRole(menu.children || [], isAdmin),
    }))
}

function isPromptMenu(menu: SystemMenuResponse): boolean {
  // 同时识别页面键和菜单编码，兼容后端菜单命名差异。
  return menu.page_key === 'promptManagement' || menu.menu_code === 'promptManagement'
}

function isDictionaryMenu(menu: SystemMenuResponse): boolean {
  // 同时识别页面键和菜单编码，确保非管理员不会看到字典管理入口。
  return menu.page_key === 'dictionaryManagement' || menu.menu_code === 'dictionaryManagement'
}

function containsPromptMenu(menus: SystemMenuResponse[]): boolean {
  // 递归检查后端是否已经提供提示词管理入口。
  return menus.some((menu) => isPromptMenu(menu) || containsPromptMenu(menu.children || []))
}

function findSystemMenu(menus: SystemMenuResponse[]): SystemMenuResponse | undefined {
  // 查找现有系统管理目录，确保提示词入口和其他后台页面处于同一分组。
  for (const menu of menus) {
    if (menu.menu_code === 'system') return menu
    const nestedMenu = findSystemMenu(menu.children || [])
    if (nestedMenu) return nestedMenu
  }
  return undefined
}

function createPromptMenu(parentMenuId: string): SystemMenuResponse {
  // 创建仅用于前端展示的提示词管理菜单节点。
  return {
    menu_id: 'frontend-prompt-management',
    parent_menu_id: parentMenuId,
    menu_code: 'promptManagement',
    menu_name: '提示词管理',
    menu_type: 'page',
    page_key: 'promptManagement',
    route_path: '/system/prompts',
    component_key: 'PromptManagementPage',
    icon: 'MessageSquareText',
    permission_code: 'system:prompt:manage',
    sort_order: 40,
    visible: true,
    status: 'active',
    metadata: { sub_label: '提示词配置' },
    children: [],
  }
}

function createSystemMenuWithPrompt(): SystemMenuResponse {
  // 后端未返回系统目录时，为管理员补充最小可用的本地系统管理分组。
  const menuId = 'frontend-system-management'
  return {
    menu_id: menuId,
    parent_menu_id: null,
    menu_code: 'system',
    menu_name: '系统管理',
    menu_type: 'directory',
    page_key: null,
    route_path: null,
    component_key: null,
    icon: 'Settings',
    permission_code: null,
    sort_order: 900,
    visible: true,
    status: 'active',
    metadata: { sub_label: '后台配置' },
    children: [createPromptMenu(menuId)],
  }
}

export function buildPortalMenus(menus: SystemMenuResponse[]): PortalMenuItem[] {
  // 把后端菜单树转换成左侧导航树；后端未返回的页面不会展示。
  return menus
    .filter((menu) => menu.visible && menu.status === 'active')
    .map((menu) => {
      const pageKey = isMainPage(menu.page_key) ? menu.page_key : undefined
      const subLabel = typeof menu.metadata?.sub_label === 'string' ? menu.metadata.sub_label : ''
      return {
        key: menu.menu_id || menu.menu_code,
        pageKey,
        routePath: normalizeRoutePath(menu.route_path),
        label: menu.menu_name,
        subLabel,
        icon: iconMap[menu.icon || ''] || Settings,
        children: buildPortalMenus(menu.children || []),
      } satisfies PortalMenuItem
    })
}
