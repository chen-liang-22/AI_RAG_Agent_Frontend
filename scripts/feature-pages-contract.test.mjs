import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const featureEntries = [
  'src/features/dashboard/HomePage.vue',
  'src/features/chat/ChatPage.vue',
  'src/features/sales-training/SalesTrainingPage.vue',
  'src/features/exam/ExamPage.vue',
]

for (const file of featureEntries) {
  if (!existsSync(join(root, file))) {
    throw new Error(`缺少 feature 页面入口：${file}`)
  }
}

const retiredCompatibilityEntries = [
  'src/api.ts',
  'src/pages/HomePage.vue',
  'src/pages/ChatPage.vue',
  'src/pages/SalesTrainingPage.vue',
  'src/pages/ExamPage.vue',
]

for (const file of retiredCompatibilityEntries) {
  const fullPath = join(root, file)
  if (existsSync(fullPath)) {
    throw new Error(`旧前端兼容入口尚未删除：${file}`)
  }
}

console.log('前端 feature 页面入口和旧兼容入口退场契约检查通过')
