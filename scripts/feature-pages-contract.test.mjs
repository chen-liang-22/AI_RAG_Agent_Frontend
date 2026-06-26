import { existsSync, readFileSync, statSync } from 'node:fs'
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

const pageShells = [
  'src/pages/HomePage.vue',
  'src/pages/ChatPage.vue',
  'src/pages/SalesTrainingPage.vue',
  'src/pages/ExamPage.vue',
]

for (const file of pageShells) {
  const fullPath = join(root, file)
  const content = readFileSync(fullPath, 'utf8')
  const size = statSync(fullPath).size
  if (size > 300) {
    throw new Error(`pages 兼容壳仍然过大：${file} ${size} 字节`)
  }
  if (!content.includes('import FeaturePage') || !content.includes('export default FeaturePage')) {
    throw new Error(`pages 兼容壳没有直接导出 feature 页面：${file}`)
  }
}

console.log('前端 feature 页面迁移契约检查通过')
