import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const appSource = readFileSync(join(process.cwd(), 'src', 'App.vue'), 'utf8')
const requiredFragments = [
  'defineAsyncComponent',
  "import('./features/dashboard/HomePage.vue')",
  "import('./features/chat/ChatPage.vue')",
  "import('./features/sales-training/SalesTrainingPage.vue')",
  "import('./features/exam/ExamPage.vue')",
]

for (const fragment of requiredFragments) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 缺少动态导入片段：${fragment}`)
  }
}

console.log('前端主页面动态导入契约检查通过')
