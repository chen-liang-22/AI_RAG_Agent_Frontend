import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageSource = readFileSync(join(root, 'package.json'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const navigationSource = readFileSync(join(root, 'src/app/navigation.ts'), 'utf8')
const shellSource = readFileSync(join(root, 'src/app/AppShell.vue'), 'utf8')

if (packageSource.includes('vue-router') || appSource.includes('vue-router')) {
  throw new Error('路径恢复不得引入 Vue Router')
}

const requiredNavigationFragments = [
  "| 'knowledgeManagement'",
  "| 'dictionaryManagement'",
  'BookKey',
  'routePath',
  'menu.route_path',
  'isDictionaryMenu',
  '!isDictionaryMenu(menu)',
  'findPageByRoutePath',
  'findRoutePathByPage',
]
for (const fragment of requiredNavigationFragments) {
  if (!navigationSource.includes(fragment)) {
    throw new Error(`导航映射缺少片段：${fragment}`)
  }
}

const requiredAppFragments = [
  "import('./features/knowledge/pages/KnowledgeManagementPage.vue')",
  "activePage === 'knowledgeManagement'",
  "import('./features/system/pages/DictionaryManagementPage.vue')",
  "activePage === 'dictionaryManagement'",
  '@forbidden="handleDictionaryForbidden"',
  'window.history.pushState',
  'window.history.replaceState',
  "window.addEventListener('popstate'",
  "window.removeEventListener('popstate'",
  'window.location.pathname',
  'findPageByRoutePath',
  'findRoutePathByPage',
]
for (const fragment of requiredAppFragments) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 缺少浏览器历史或字典页恢复片段：${fragment}`)
  }
}
if (!shellSource.includes("emit('navigate'")) {
  throw new Error('AppShell.vue 未把授权菜单导航交给 App.vue 统一写入历史记录')
}

console.log('无 Router 浏览器历史与授权路径恢复契约检查通过')
