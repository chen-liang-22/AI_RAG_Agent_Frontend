import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pageSource = readFileSync(join(root, 'src/features/chat/pages/ChatPage.vue'), 'utf8')

const quickActionsMatch = pageSource.match(/<div class="quick-actions">(?<content>[\s\S]*?)<\/div>\s*<\/header>/)
if (!quickActionsMatch?.groups?.content) {
  throw new Error('未找到智能客服顶部快捷操作区')
}

const quickActionsSource = quickActionsMatch.groups.content
const usageReportIndex = quickActionsSource.indexOf('使用报告')
const recentConversationIndex = quickActionsSource.indexOf('最近会话')

if (usageReportIndex < 0) {
  throw new Error('顶部快捷操作区缺少使用报告按钮')
}
if (recentConversationIndex < 0) {
  throw new Error('顶部快捷操作区需要在使用报告后新增最近会话按钮')
}
if (recentConversationIndex < usageReportIndex) {
  throw new Error('最近会话按钮必须放在使用报告按钮后面')
}

const recentButtonSource = quickActionsSource.slice(usageReportIndex, recentConversationIndex + 60)
if (!recentButtonSource.includes('@click="openConversationDialog()"')) {
  throw new Error('最近会话按钮需要调用 openConversationDialog() 打开聊天记录弹窗')
}

if (pageSource.includes('会话工作台') || pageSource.includes('class="workspace-card"')) {
  throw new Error('最近会话入口只能放在顶部快捷区，不能恢复左侧会话工作台')
}

console.log('智能客服顶部最近会话入口契约检查通过')
