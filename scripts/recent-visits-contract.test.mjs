import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const recentPath = join(root, 'src/app/recentVisits.ts')
if (!existsSync(recentPath)) {
  throw new Error('缺少最近访问存储模块：src/app/recentVisits.ts')
}

const recentSource = readFileSync(recentPath, 'utf8')
const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')

const requiredFragments = [
  'MAX_RECENT_VISITS = 5',
  'userId',
  'pageKey',
  'visitedAt',
  'localStorage',
  'JSON.parse',
  'catch',
  'allowedPages',
  'recordRecentVisit',
  'loadRecentVisits',
]
for (const fragment of requiredFragments) {
  if (!recentSource.includes(fragment)) {
    throw new Error(`最近访问模块缺少片段：${fragment}`)
  }
}
for (const forbidden of ['label:', 'routePath:', 'icon:']) {
  if (recentSource.includes(forbidden)) {
    throw new Error(`最近访问持久化了菜单快照字段：${forbidden}`)
  }
}
for (const fragment of ['recordRecentVisit', 'loadRecentVisits', ':recent-visits="recentVisits"']) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 未接入最近访问：${fragment}`)
  }
}

console.log('按用户隔离的最近访问契约检查通过')
