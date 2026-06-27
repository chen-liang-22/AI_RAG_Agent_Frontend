import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/app/LoginGate.vue',
  'src/app/AppShell.vue',
  'src/app/navigation.ts',
]

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`缺少前端应用壳模块：${file}`)
  }
}

const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const appShellSource = readFileSync(join(root, 'src/app/AppShell.vue'), 'utf8')
const navigationSource = readFileSync(join(root, 'src/app/navigation.ts'), 'utf8')
const forbiddenFragments = ['class="login-card"', 'class="portal-sidebar"']
for (const fragment of forbiddenFragments) {
  if (appSource.includes(fragment)) {
    throw new Error(`App.vue 仍包含页面壳模板片段：${fragment}`)
  }
}

const forbiddenMenuFallbackFragments = [
  'portalPages',
  '默认菜单',
  '兜底菜单',
  'props.menus?.length',
  '<HomePage v-else',
]

for (const fragment of forbiddenMenuFallbackFragments) {
  if (appSource.includes(fragment) || appShellSource.includes(fragment) || navigationSource.includes(fragment)) {
    throw new Error(`前端菜单仍存在本地兜底逻辑：${fragment}`)
  }
}

if (!appSource.includes('hasActivePageAccess')) {
  throw new Error('App.vue 缺少基于后端菜单的页面访问判断')
}

console.log('前端应用壳拆分契约检查通过')
