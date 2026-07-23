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
const salesTrainingSource = readFileSync(
  join(root, 'src/features/sales-training/pages/SalesTrainingPage.vue'),
  'utf8',
)
const salesTrainingApiSource = readFileSync(join(root, 'src/features/sales-training/api/index.ts'), 'utf8')

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

const formalTrainingCollection = 'sales_training_cases'
const stagingTrainingCollection = 'sales_training_cases_staging'
if (!pageSource.includes(`const SALES_TRAINING_COLLECTION = '${formalTrainingCollection}'`)
  || !pageSource.includes(`'${stagingTrainingCollection}'`)) {
  throw new Error('知识库管理页未区分销售训练正式 collection 与技术临时 collection')
}
const reservedCollectionsStart = pageSource.indexOf('const RESERVED_KNOWLEDGE_COLLECTIONS = new Set([')
const reservedCollectionsEnd = pageSource.indexOf('])', reservedCollectionsStart)
const reservedCollectionsSource = pageSource.slice(reservedCollectionsStart, reservedCollectionsEnd)
if (reservedCollectionsStart < 0
  || reservedCollectionsEnd < 0
  || reservedCollectionsSource.includes(`'${formalTrainingCollection}',`)) {
  throw new Error('销售训练正式 collection 不得作为保留集合过滤')
}

const collectionOptionsStart = pageSource.indexOf('const collectionOptions = computed')
const collectionTabsStart = pageSource.indexOf('const knowledgeCollectionTabs = computed')
const collectionOptionsSource = pageSource.slice(collectionOptionsStart, collectionTabsStart)
if (collectionOptionsStart < 0
  || collectionTabsStart < 0
  || !collectionOptionsSource.includes('isReservedKnowledgeCollection(collectionName)')) {
  throw new Error('collectionOptions 未过滤技术临时 collection')
}
const globalCollectionConsumers = [
  '{{ collectionOptions.length }}',
  'v-for="tab in knowledgeCollectionTabs"',
]
for (const fragment of globalCollectionConsumers) {
  if (!pageSource.includes(fragment)) {
    throw new Error(`保留 collection 过滤结果未覆盖页面消费者：${fragment}`)
  }
}
const generalUploadOptionsStart = pageSource.indexOf('const generalUploadCollectionOptions = computed')
const knowledgeTabsStart = pageSource.indexOf('const knowledgeCollectionTabs = computed')
const generalUploadOptionsSource = pageSource.slice(generalUploadOptionsStart, knowledgeTabsStart)
if (generalUploadOptionsStart < 0
  || knowledgeTabsStart < 0
  || !generalUploadOptionsSource.includes('isSalesTrainingCollection(collectionName)')
  || !pageSource.includes('v-for="collectionName in generalUploadCollectionOptions"')) {
  throw new Error('通用上传候选未排除销售训练正式 collection')
}
if (!pageSource.includes(
  'knowledgeFiles.value = files.filter((file) => !isReservedKnowledgeCollection(file.collection_name))',
)) {
  throw new Error('全局知识库文件列表未过滤技术临时 collection')
}

const collectionWatchStart = pageSource.indexOf('watch(collectionOptions')
const dictionaryHelperStart = pageSource.indexOf('function flattenDictionaryItems')
const collectionWatchSource = pageSource.slice(collectionWatchStart, dictionaryHelperStart)
if (collectionWatchStart < 0
  || dictionaryHelperStart < 0
  || !collectionWatchSource.includes('collections.includes(activeKnowledgeCollection.value)')) {
  throw new Error('知识库刷新后未修正失效或临时的当前 collection')
}

const uploadChangeStart = pageSource.indexOf('async function handleKnowledgeFileChange')
const uploadRecommendStart = pageSource.indexOf('async function handleRecommendKnowledgeUpload')
const uploadChangeSource = pageSource.slice(uploadChangeStart, uploadRecommendStart)
if (uploadChangeStart < 0
  || uploadRecommendStart < 0
  || !uploadChangeSource.includes("generalUploadCollectionOptions.value[0] || 'agent'")
  || uploadChangeSource.includes('health.value?.collection_name')) {
  throw new Error('通用上传预览仍可能自动选中销售训练或技术临时 collection')
}

const uploadConfirmStart = pageSource.indexOf('async function handleConfirmKnowledgeUpload')
const uploadResetStart = pageSource.indexOf('function resetUploadPreview')
const uploadConfirmSource = pageSource.slice(uploadConfirmStart, uploadResetStart)
const reservedGuardIndex = uploadConfirmSource.indexOf('isReservedKnowledgeCollection(targetCollection)')
const trainingGuardIndex = uploadConfirmSource.indexOf('isSalesTrainingCollection(targetCollection)')
const confirmRequestIndex = uploadConfirmSource.indexOf('confirmKnowledgeUpload(')
if (uploadConfirmStart < 0
  || uploadResetStart < 0
  || reservedGuardIndex < 0
  || trainingGuardIndex < 0
  || confirmRequestIndex < 0
  || reservedGuardIndex > confirmRequestIndex
  || trainingGuardIndex > confirmRequestIndex
  || !uploadConfirmSource.includes('销售训练临时集合不能作为上传目标')
  || !uploadConfirmSource.includes('销售训练资料请通过销售训练资料上传流程处理')) {
  throw new Error('普通确认入库前未拦截销售训练正式或技术临时 collection')
}

const requiredUploadRoutingFragments = [
  'uploadTypeDialogVisible',
  'openKnowledgeUploadTypeDialog',
  'openSalesTrainingKnowledgeUpload',
  'openSalesTrainingKnowledge: []',
  '选择资料类型',
  '通用知识',
  '销售训练资料',
]
for (const fragment of requiredUploadRoutingFragments) {
  if (!pageSource.includes(fragment)) {
    throw new Error(`知识库上传缺少资料类型分流：${fragment}`)
  }
}
if (pageSource.includes('uploadTrainingKnowledge')) {
  throw new Error('知识库管理页不得复制销售训练上传控制逻辑')
}

const listKnowledgeFileCalls = Array.from(
  pageSource.matchAll(/\blistKnowledgeFiles\s*\(([^)]*)\)/g),
  (match) => match[1].trim(),
)
if (!listKnowledgeFileCalls.length || listKnowledgeFileCalls.some((argument) => argument !== 'true')) {
  throw new Error('全局知识库页面必须使用 listKnowledgeFiles(true) 加载销售训练正式资料')
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
if (!appSource.includes('@open-sales-training-knowledge="handleSalesTrainingKnowledgeNavigation"')
  || !appSource.includes(':initial-workspace-tab="salesTrainingInitialWorkspaceTab"')) {
  throw new Error('App.vue 未将销售训练资料入口交接到既有销售陪练工作区')
}
if (!salesTrainingSource.includes('initialWorkspaceTab?: TrainingWorkspaceTab')
  || !salesTrainingSource.includes('ref<TrainingWorkspaceTab>(props.initialWorkspaceTab)')
  || !salesTrainingSource.includes('TrainingKnowledgeUploadPanel')
  || !salesTrainingSource.includes('TrainingKnowledgeWorkspace')
  || !salesTrainingSource.includes('uploadTrainingKnowledge({')) {
  throw new Error('销售陪练页未复用既有资料上传、质量检查和批次管理流程')
}
if (!salesTrainingApiSource.includes("fetchWithAuth('/training/knowledge/upload'")) {
  throw new Error('销售训练资料入口未保留 /training/knowledge/upload 专用上传链路')
}
if (!navigationSource.includes("| 'knowledgeManagement'") || !navigationSource.includes('BookKey')) {
  throw new Error('navigation.ts 未注册 knowledgeManagement 或 BookKey 图标')
}

console.log('全局知识库列表、分流上传与 Chat collection 只读边界契约检查通过')
