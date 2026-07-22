import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pagePath = join(root, 'src/features/knowledge/pages/KnowledgeManagementPage.vue')
if (!existsSync(pagePath)) {
  throw new Error('缺少独立知识库管理页面：src/features/knowledge/pages/KnowledgeManagementPage.vue')
}

const pageSource = readFileSync(pagePath, 'utf8')
const chatSource = readFileSync(join(root, 'src/features/chat/pages/ChatPage.vue'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const navigationSource = readFileSync(join(root, 'src/app/navigation.ts'), 'utf8')

const requiredPageFragments = [
  'fetchKnowledgeUploadOptions',
  'previewKnowledgeFile',
  'recommendKnowledgeUpload',
  'confirmKnowledgeUpload',
  'listKnowledgeFiles',
  'previewKnowledgeDocument',
  'deleteKnowledgeFile',
  'reindexKnowledgeFile',
  'reindexAllKnowledgeFiles',
  'FilePreviewDialog',
  'knowledgeCollectionTabs',
  'handleKnowledgeFileChange',
  ':accept="uploadOptions.accept"',
  'filterable',
  'allow-create',
  "dictionaryItems('document_structure')",
  "dictionaryItems('split_strategy')",
  '确认入库',
  '清空并重建',
]
for (const fragment of requiredPageFragments) {
  if (!pageSource.includes(fragment)) {
    throw new Error(`独立知识库管理页缺少功能片段：${fragment}`)
  }
}

const forbiddenChatFragments = [
  'confirmKnowledgeUpload',
  'deleteKnowledgeFile',
  'previewKnowledgeDocument',
  'recommendKnowledgeUpload',
  'reindexAllKnowledgeFiles',
  'reindexKnowledgeFile',
  'FilePreviewDialog',
  'knowledgeDialogVisible',
  'selectedUploadCollection',
  'uploadPreview',
  'uploadRecommendation',
  'knowledgePreview',
  'handleKnowledgeFileChange',
]
for (const fragment of forbiddenChatFragments) {
  if (chatSource.includes(fragment)) {
    throw new Error(`ChatPage.vue 仍包含知识库管理能力：${fragment}`)
  }
}

const requiredChatFragments = [
  'listKnowledgeFiles',
  'knowledgeFiles',
  'collectionOptions',
  'selectedCollectionName',
]
for (const fragment of requiredChatFragments) {
  if (!chatSource.includes(fragment)) {
    throw new Error(`ChatPage.vue 误删聊天 collection 只读能力：${fragment}`)
  }
}

if (!appSource.includes("import('./features/knowledge/pages/KnowledgeManagementPage.vue')")
  || !appSource.includes("activePage === 'knowledgeManagement'")) {
  throw new Error('App.vue 未接入知识库管理异步页面')
}
if (!navigationSource.includes("| 'knowledgeManagement'") || !navigationSource.includes('BookKey')) {
  throw new Error('navigation.ts 未注册 knowledgeManagement 或 BookKey 图标')
}

console.log('独立知识库管理页与 Chat collection 只读边界契约检查通过')
