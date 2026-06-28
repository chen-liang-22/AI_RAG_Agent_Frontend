import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const appSource = readFileSync(join(process.cwd(), 'src', 'App.vue'), 'utf8')
const requiredFragments = [
  'defineAsyncComponent',
  "import('./features/dashboard/pages/HomePage.vue')",
  "import('./features/chat/pages/ChatPage.vue')",
  "import('./features/sales-training/pages/SalesTrainingPage.vue')",
  "import('./features/exam/pages/ExamPage.vue')",
  "import('./features/system/pages/UserManagementPage.vue')",
  "import('./features/system/pages/RoleManagementPage.vue')",
  "import('./features/system/pages/MenuManagementPage.vue')",
]

for (const fragment of requiredFragments) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 缺少动态导入片段：${fragment}`)
  }
}

console.log('前端主页面动态导入契约检查通过')
