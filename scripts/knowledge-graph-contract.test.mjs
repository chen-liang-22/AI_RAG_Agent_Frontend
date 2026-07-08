import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'src/features/knowledge-graph/pages/KnowledgeGraphPage.vue',
  'src/shared/api/graph.ts',
  'src/shared/api/types/graph.ts',
]

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`缺少知识图谱前端文件：${file}`)
  }
}

const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const navigationSource = readFileSync(join(root, 'src/app/navigation.ts'), 'utf8')
const apiIndexSource = readFileSync(join(root, 'src/shared/api/index.ts'), 'utf8')
const typesIndexSource = readFileSync(join(root, 'src/shared/api/types/index.ts'), 'utf8')
const graphTypesSource = readFileSync(join(root, 'src/shared/api/types/graph.ts'), 'utf8')
const graphApiSource = readFileSync(join(root, 'src/shared/api/graph.ts'), 'utf8')
const graphPageSource = readFileSync(join(root, 'src/features/knowledge-graph/pages/KnowledgeGraphPage.vue'), 'utf8')

const requiredFragments = [
  "import('./features/knowledge-graph/pages/KnowledgeGraphPage.vue')",
  "activePage === 'knowledgeGraph'",
]

for (const fragment of requiredFragments) {
  if (!appSource.includes(fragment)) {
    throw new Error(`App.vue 缺少知识图谱入口：${fragment}`)
  }
}

if (!navigationSource.includes('knowledgeGraph') || !navigationSource.includes('Network')) {
  throw new Error('导航未注册 knowledgeGraph 页面或 Network 图标')
}

if (!apiIndexSource.includes("export * from './graph'")) {
  throw new Error('shared/api/index.ts 未导出 graph API')
}

if (!typesIndexSource.includes("export * from './graph'")) {
  throw new Error('shared/api/types/index.ts 未导出 graph 类型')
}

for (const endpoint of ['/graph/health', '/graph/init', '/graph/overview', '/graph/documents?', '/graph/documents/']) {
  if (!graphApiSource.includes(endpoint)) {
    throw new Error(`graph API 缺少接口封装：${endpoint}`)
  }
}

for (const text of ['知识图谱驾驶舱', 'Neo4j', '节点分布', '关系分布', '文件图谱查询', '最近图谱文件', '输入文件名称关键词']) {
  if (!graphPageSource.includes(text)) {
    throw new Error(`知识图谱页面缺少展示文案：${text}`)
  }
}

for (const fragment of ['fetchGraphDocuments', '@row-click="selectGraphDocument"', 'GraphDocumentSummary']) {
  if (!graphPageSource.includes(fragment) && !graphApiSource.includes(fragment) && !graphTypesSource.includes(fragment)) {
    throw new Error(`知识图谱页面缺少文件名查询交互：${fragment}`)
  }
}

console.log('知识图谱前端入口契约检查通过')
