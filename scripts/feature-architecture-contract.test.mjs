import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'src/features/dashboard/pages/HomePage.vue',
  'src/features/chat/pages/ChatPage.vue',
  'src/features/sales-training/pages/SalesTrainingPage.vue',
  'src/features/exam/pages/ExamPage.vue',
  'src/features/sales-training/components/TrainingKnowledgeUploadPanel.vue',
  'src/features/sales-training/components/TrainingKnowledgeWorkspace.vue',
  'src/features/sales-training/components/TrainingReviewWorkspace.vue',
  'src/features/sales-training/api/index.ts',
  'src/features/sales-training/types.ts',
  'src/features/sales-training/composables/trainingDisplay.ts',
  'src/shared/api/types/index.ts',
  'src/shared/api/types/common.ts',
  'src/shared/api/types/auth.ts',
  'src/shared/api/types/chat.ts',
  'src/shared/api/types/conversations.ts',
  'src/shared/api/types/dictionaries.ts',
  'src/shared/api/types/exam.ts',
  'src/shared/api/types/knowledge.ts',
  'src/shared/api/types/system.ts',
]

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`缺少前端目标架构文件：${file}`)
  }
}

const retiredFiles = [
  'src/features/dashboard/HomePage.vue',
  'src/features/chat/ChatPage.vue',
  'src/features/sales-training/SalesTrainingPage.vue',
  'src/features/exam/ExamPage.vue',
  'src/components/sales-training/TrainingKnowledgeUploadPanel.vue',
  'src/components/sales-training/TrainingKnowledgeWorkspace.vue',
  'src/components/sales-training/TrainingReviewWorkspace.vue',
  'src/utils/trainingDisplay.ts',
  'src/shared/api/types.ts',
]

for (const file of retiredFiles) {
  if (existsSync(join(root, file))) {
    throw new Error(`旧前端架构文件仍未迁移：${file}`)
  }
}

const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const appImports = [
  "import('./features/dashboard/pages/HomePage.vue')",
  "import('./features/chat/pages/ChatPage.vue')",
  "import('./features/sales-training/pages/SalesTrainingPage.vue')",
  "import('./features/exam/pages/ExamPage.vue')",
]

for (const fragment of appImports) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 未使用新页面入口：${fragment}`)
  }
}

const salesTrainingPageSource = readFileSync(
  join(root, 'src/features/sales-training/pages/SalesTrainingPage.vue'),
  'utf8',
)
const forbiddenSalesTrainingImports = [
  '../../components/sales-training/',
  '../../utils/trainingDisplay',
]

for (const fragment of forbiddenSalesTrainingImports) {
  if (salesTrainingPageSource.includes(fragment)) {
    throw new Error(`销售训练页面仍依赖旧公共路径：${fragment}`)
  }
}

console.log('前端 feature-first 架构契约检查通过')
