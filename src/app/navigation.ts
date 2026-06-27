import {
  Bot,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { SystemMenuResponse } from '../shared/api'

export type ThemeMode = 'dark' | 'light'
export type MainPage = 'home' | 'chat' | 'exam' | 'salesTraining' | 'userManagement' | 'roleManagement' | 'menuManagement'

export interface PortalMenuItem { // 左侧菜单渲染项，兼容后端菜单和本地兜底菜单
  key: string
  label: string
  subLabel: string
  icon: Component
  pageKey?: MainPage
  children: PortalMenuItem[]
}

const iconMap: Record<string, Component> = {
  Bot,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Users,
}

export const portalPages: PortalMenuItem[] = [
  { key: 'home', pageKey: 'home', label: '首页', subLabel: '系统驾驶舱', icon: LayoutDashboard, children: [] },
  { key: 'chat', pageKey: 'chat', label: '智能客服', subLabel: 'RAG 问答', icon: Bot, children: [] },
  { key: 'salesTraining', pageKey: 'salesTraining', label: '销售陪练', subLabel: 'AI 客户训练', icon: BrainCircuit, children: [] },
  { key: 'exam', pageKey: 'exam', label: '问答考试', subLabel: '知识测评', icon: ClipboardCheck, children: [] },
]

export function isMainPage(value: string | null | undefined): value is MainPage {
  // 后端 page_key 只有命中本地页面映射时才允许切换，避免进入空白页。
  return ['home', 'chat', 'exam', 'salesTraining', 'userManagement', 'roleManagement', 'menuManagement'].includes(String(value || ''))
}

export function buildPortalMenus(menus: SystemMenuResponse[]): PortalMenuItem[] {
  // 把后端菜单树转换成左侧导航树，后端异常时由调用方继续使用 portalPages。
  return menus
    .filter((menu) => menu.visible && menu.status === 'active')
    .map((menu) => {
      const pageKey = isMainPage(menu.page_key) ? menu.page_key : undefined
      const subLabel = typeof menu.metadata?.sub_label === 'string' ? menu.metadata.sub_label : ''
      return {
        key: menu.menu_id || menu.menu_code,
        pageKey,
        label: menu.menu_name,
        subLabel,
        icon: iconMap[menu.icon || ''] || Settings,
        children: buildPortalMenus(menu.children || []),
      } satisfies PortalMenuItem
    })
}
