import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const homeSource = readFileSync(join(root, 'src/features/dashboard/pages/HomePage.vue'), 'utf8')
const uploadPanelSource = readFileSync(
  join(root, 'src/features/sales-training/components/TrainingKnowledgeUploadPanel.vue'),
  'utf8',
)
const salesTrainingSource = readFileSync(
  join(root, 'src/features/sales-training/pages/SalesTrainingPage.vue'),
  'utf8',
)
const knowledgeApiSource = readFileSync(join(root, 'src/shared/api/knowledge.ts'), 'utf8')
const knowledgeTypesSource = readFileSync(join(root, 'src/shared/api/types/knowledge.ts'), 'utf8')
const sharedUploadOptionsSource = readFileSync(join(root, 'src/shared/knowledgeUploadOptions.ts'), 'utf8')

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}

function assertNotIncludes(source, forbidden, message) {
  if (source.includes(forbidden)) {
    throw new Error(message)
  }
}

assertIncludes(
  knowledgeApiSource,
  'fetchKnowledgeUploadOptions',
  '前端需要通过 API 获取后端上传能力，不能让页面自己猜文件类型',
)
assertIncludes(
  knowledgeTypesSource,
  'KnowledgeUploadOptionsResponse',
  '上传能力响应类型缺失，页面无法获得 accept 和展示文案',
)
assertIncludes(
  homeSource,
  ':accept="knowledgeUploadAccept"',
  '通用知识库上传 input 应绑定后端返回的 accept',
)
assertIncludes(
  homeSource,
  ':upload-accept="knowledgeUploadAccept"',
  '销售训练上传面板应复用同一份上传 accept',
)
assertIncludes(
  salesTrainingSource,
  ':upload-accept="knowledgeUploadAccept"',
  '销售训练主页面也应复用后端返回的上传 accept',
)
assertIncludes(
  salesTrainingSource,
  'fetchKnowledgeUploadOptions',
  '销售训练主页面需要主动读取后端上传能力',
)
assertIncludes(
  sharedUploadOptionsSource,
  'DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS',
  '前端本地兜底上传格式应集中在共享配置文件，不能分散在页面里',
)
assertIncludes(
  uploadPanelSource,
  'uploadAccept: string',
  '训练资料上传面板需要把 accept 作为 props 接收',
)
assertIncludes(
  uploadPanelSource,
  ':accept="uploadAccept"',
  '训练资料上传 input 应绑定父级传入的 accept',
)
assertIncludes(
  uploadPanelSource,
  'uploadDisplayText: string',
  '训练资料上传面板需要使用动态文件类型文案',
)

assertNotIncludes(
  homeSource,
  'accept=".txt,.pdf"',
  '通用知识库上传仍写死 .txt,.pdf',
)
assertNotIncludes(
  uploadPanelSource,
  'accept=".docx,.pdf,.txt"',
  '训练资料上传仍写死 .docx,.pdf,.txt',
)
assertNotIncludes(
  uploadPanelSource,
  '支持 DOCX、PDF、TXT 格式',
  '训练资料上传提示仍写死旧格式',
)
assertNotIncludes(
  salesTrainingSource,
  'accept=".docx,.pdf,.txt"',
  '销售训练主页面仍写死 .docx,.pdf,.txt',
)

console.log('上传能力动态配置契约检查通过')
