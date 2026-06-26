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
const forbiddenFragments = ['class="login-card"', 'class="portal-sidebar"']
for (const fragment of forbiddenFragments) {
  if (appSource.includes(fragment)) {
    throw new Error(`App.vue 仍包含页面壳模板片段：${fragment}`)
  }
}

console.log('前端应用壳拆分契约检查通过')
