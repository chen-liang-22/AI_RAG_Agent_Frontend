import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const homeSource = readFileSync(join(root, 'src/features/dashboard/pages/HomePage.vue'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const appShellSource = readFileSync(join(root, 'src/app/AppShell.vue'), 'utf8')

const forbiddenHomeFragments = [
  "from '../../../shared/api'",
  'listConversations',
  'getConversationDetail',
  'listExamSessions',
  'listKnowledgeFiles',
  'listDictionaries',
  'listTrainingSessions',
  'ElMessageBox',
  '<el-dialog',
  '知识库管理',
  '最近会话',
  '销售驾驶舱',
  'cockpitCards',
  'fallback',
  'mock',
]

for (const fragment of forbiddenHomeFragments) {
  if (homeSource.includes(fragment)) {
    throw new Error(`中性首页仍包含业务管理、写接口或假数据片段：${fragment}`)
  }
}

const requiredHomeFragments = [
  'defineProps',
  'currentUser',
  'menus',
  'health',
  'recentVisits',
  '授权菜单',
  '搜索可访问页面',
  '当前角色',
  '可用菜单',
  '服务状态',
  '更新时间',
  '最近访问',
  '暂无最近访问记录',
  "emit('openPage'",
  'refreshHome: []',
  'const currentDate = ref(new Date())',
  'currentDate.value.getHours()',
  '.format(currentDate.value)',
  'currentDate.value = new Date()',
  "emit('refreshHome')",
]

for (const fragment of requiredHomeFragments) {
  if (!homeSource.includes(fragment)) {
    throw new Error(`中性首页缺少必需片段：${fragment}`)
  }
}

if (!appSource.includes('fetchHealth') || !appSource.includes('healthRefreshedAt')) {
  throw new Error('App.vue 尚未统一持有健康状态和刷新时间')
}
if (appShellSource.includes("import { fetchHealth") || appShellSource.includes('onMounted')) {
  throw new Error('AppShell.vue 仍自行发起健康请求')
}
for (const fragment of [':health="health"', ':health-loading="healthLoading"', '@refresh-health="refreshHealth"']) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 未向顶栏或首页复用健康状态：${fragment}`)
  }
}
for (const fragment of [
  'async function refreshHome()',
  'Promise.all([loadPortalMenus(), refreshHealth()])',
  '@refresh-home="refreshHome"',
]) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 未在首页刷新时并发更新菜单与健康状态：${fragment}`)
  }
}

console.log('中性首页与共享健康状态契约检查通过')
