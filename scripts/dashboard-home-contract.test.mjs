import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const homeSource = readFileSync(join(root, 'src/features/dashboard/HomePage.vue'), 'utf8')

const forbiddenHomeFragments = [
  '知识库概览',
  '知识矩阵',
  '多库航道',
  '字典引擎',
  '会话星轨',
  'overviewKnowledgeFiles',
  'overviewPagedKnowledgeFiles',
  'overviewCollectionTabs',
  'overview-collection-tabs',
  'dashboard-knowledge-table',
]

for (const fragment of forbiddenHomeFragments) {
  if (homeSource.includes(fragment)) {
    throw new Error(`首页仍包含知识库概览片段：${fragment}`)
  }
}

if (!homeSource.includes('最近会话')) {
  throw new Error('首页最近会话模块被误删')
}

console.log('首页知识库概览删除契约检查通过')
