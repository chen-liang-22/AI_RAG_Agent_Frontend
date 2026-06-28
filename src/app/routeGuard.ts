import type { SystemMenuResponse } from '../shared/api'
import { isMainPage, type MainPage, type PortalMenuItem } from './navigation'

export function collectAllowedPagesFromPortalMenus(menus: PortalMenuItem[]): Set<MainPage> {
  const pages = new Set<MainPage>()
  const visit = (items: PortalMenuItem[]) => {
    for (const item of items) {
      if (item.pageKey) pages.add(item.pageKey)
      visit(item.children)
    }
  }
  visit(menus)
  return pages
}

export function collectAllowedPagesFromSystemMenus(menus: SystemMenuResponse[]): Set<MainPage> {
  const pages = new Set<MainPage>()
  const visit = (items: SystemMenuResponse[]) => {
    for (const item of items) {
      if (isMainPage(item.page_key)) pages.add(item.page_key)
      visit(item.children || [])
    }
  }
  visit(menus)
  return pages
}

export function resolveAccessiblePage(currentPage: MainPage, allowedPages: Set<MainPage>): MainPage {
  if (!allowedPages.size || allowedPages.has(currentPage)) return currentPage
  return allowedPages.has('home') ? 'home' : Array.from(allowedPages)[0]
}
