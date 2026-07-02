import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pageSource = readFileSync(join(root, 'src/features/chat/pages/ChatPage.vue'), 'utf8')

const removedWorkbenchMarkers = [
  '会话工作台',
  '扫描 data',
  'class="workspace-actions"',
  'class="workspace-card"',
  'handleReloadKnowledge',
]

for (const marker of removedWorkbenchMarkers) {
  if (pageSource.includes(marker)) {
    throw new Error(`智能客服页面不应继续展示或保留会话工作台入口：${marker}`)
  }
}

console.log('智能客服会话工作台删除契约检查通过')
