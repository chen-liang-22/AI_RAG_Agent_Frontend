import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pagePath = join(root, 'src/features/system/pages/DictionaryManagementPage.vue')
if (!existsSync(pagePath)) {
  throw new Error('缺少独立字典管理页面：src/features/system/pages/DictionaryManagementPage.vue')
}

const pageSource = readFileSync(pagePath, 'utf8')
const apiSource = readFileSync(join(root, 'src/shared/api/dictionaries.ts'), 'utf8')
const typeSource = readFileSync(join(root, 'src/shared/api/types/dictionaries.ts'), 'utf8')
const chatSource = readFileSync(join(root, 'src/features/chat/pages/ChatPage.vue'), 'utf8')

const requiredApiFragments = [
  'DictionaryGroupUpdatePayload',
  'DictionaryItemCreatePayload',
  'DictionaryItemUpdatePayload',
  "request<DictionaryItemResponse>('/dictionaries/items'",
  'method: \'POST\'',
  'method: \'PUT\'',
  'method: \'PATCH\'',
  'method: \'DELETE\'',
]
for (const fragment of requiredApiFragments) {
  if (!apiSource.includes(fragment) && !typeSource.includes(fragment)) {
    throw new Error(`字典 API 或类型缺少契约片段：${fragment}`)
  }
}
if (apiSource.includes('createDictionaryGroup')) {
  throw new Error('字典 API 仍暴露不存在的 POST /dictionaries 分组创建接口')
}

const requiredPageFragments = [
  'createDictionaryItem',
  'updateDictionaryGroup',
  'updateDictionaryItem',
  'setDictionaryItemEnabled',
  'deleteDictionaryItem',
  'deleteDictionaryGroup',
  "currentUser.role !== 'admin'",
  "emit('forbidden')",
  'error instanceof HttpError && error.status === 403',
  'JSON.parse',
  'metadataText',
  'parentItemId',
  'sortOrder',
  'row-key="dictionary_item_id"',
  '此操作不可恢复',
  'itemCount(activeGroup.value) === 1',
  '删除后该分组将同时消失',
  '新增分组及首项',
  '仅可修改分组名称',
]
for (const fragment of requiredPageFragments) {
  if (!pageSource.includes(fragment)) {
    throw new Error(`独立字典管理页缺少功能片段：${fragment}`)
  }
}

const forbiddenChatFragments = [
  'createDictionaryGroup',
  'createDictionaryItem',
  'deleteDictionaryGroup',
  'deleteDictionaryItem',
  'setDictionaryItemEnabled',
  'updateDictionaryGroup',
  'updateDictionaryItem',
  'DictionaryFormState',
  'dictionaryDialogVisible',
  'dictionaryGroupDialogVisible',
  'dictionaryItemDialogVisible',
  '字典表管理',
]
for (const fragment of forbiddenChatFragments) {
  if (chatSource.includes(fragment)) {
    throw new Error(`ChatPage.vue 仍包含字典管理能力：${fragment}`)
  }
}
if (!chatSource.includes('listDictionaries')) {
  throw new Error('ChatPage.vue 误删字典只读查询能力')
}

console.log('独立字典管理页与 Chat 只读边界契约检查通过')
