<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Activity,
  ArrowLeft,
  Bot,
  Boxes,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Eye,
  FileText,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  confirmKnowledgeUpload,
  createDictionaryGroup,
  createDictionaryItem,
  deleteDictionaryGroup,
  deleteDictionaryItem,
  deleteKnowledgeFile,
  fetchHealth,
  getConversationDetail,
  listConversations,
  listDictionaries,
  listKnowledgeFiles,
  previewKnowledgeDocument,
  previewKnowledgeFile,
  recommendKnowledgeUpload,
  reindexAllKnowledgeFiles,
  reindexKnowledgeFile,
  setDictionaryItemEnabled,
  updateDictionaryGroup,
  updateDictionaryItem,
  type ConversationSummaryResponse,
  type DictionaryGroupResponse,
  type DictionaryItemResponse,
  type HealthResponse,
  type KnowledgeFilePreviewResponse,
  type KnowledgeFileResponse,
  type KnowledgeUploadPreviewResponse,
  type KnowledgeUploadRecommendResponse,
} from '../api'

defineProps<{ themeMode: 'dark' | 'light' }>()
const emit = defineEmits<{
  openChatHistory: [conversationId: string]
}>()

interface DictionaryFormState { // 字典项编辑表单，字段和后端字典项保存接口一一对应
  dictionaryCode: string
  dictionaryName: string
  itemCode: string
  itemName: string
  parentItemId: string
  sortOrder: number
  enabled: boolean
  description: string
  metadataText: string
}

interface DictionaryGroupFormState { // 父级字典编辑表单，用于新增或修改字典分组
  dictionaryCode: string
  dictionaryName: string
}

const loading = ref(false) // 首页总览刷新状态
const health = ref<HealthResponse | null>(null) // 后端健康检查结果
const knowledgeFiles = ref<KnowledgeFileResponse[]>([]) // 后端知识库文件列表
const dictionaries = ref<DictionaryGroupResponse[]>([]) // 后端系统字典分组
const conversations = ref<ConversationSummaryResponse[]>([]) // 最近会话列表
const conversationTotal = ref(0) // 会话总数
const conversationTooltipMap = ref<Record<string, string>>({}) // 最近会话悬浮提示，优先展示完整用户问题
const overviewActiveCollection = ref('') // 首页知识库概览当前选中的向量库
const overviewKnowledgePage = ref(1) // 首页知识库概览分页页码
const overviewKnowledgePageSize = 6 // 首页知识库概览每页展示 6 条，兼顾信息量和一屏可读性
const overviewConversationPage = ref(1) // 首页最近会话分页页码
const overviewConversationPageSize = 6 // 首页最近会话每页展示 6 条

const knowledgeDialogVisible = ref(false) // 知识库管理弹窗开关
const knowledgeLoading = ref(false) // 知识库文件列表加载状态
const knowledgeKeyword = ref('') // 知识库文件名搜索关键词
const knowledgeFileInput = ref<HTMLInputElement | null>(null) // 隐藏文件选择框
const activeKnowledgeCollection = ref('') // 当前知识库 collection 页签
const knowledgePage = ref(1) // 知识库文件分页页码
const knowledgePageSize = 9 // 知识库文件每页 9 个，页面上保持三列三行
const activeKnowledgeAction = ref('') // 当前知识库文件操作 loading key
const reindexingAll = ref(false) // 批量重建索引状态
const uploadingKnowledge = ref(false) // 上传预览状态
const confirmingKnowledge = ref(false) // 确认入库状态
const recommendingKnowledge = ref(false) // 模型推荐切分方式状态
const uploadPreviewVisible = ref(false) // 上传确认弹窗开关
const uploadPreview = ref<KnowledgeUploadPreviewResponse | null>(null) // 上传预解析结果
const uploadRecommendation = ref<KnowledgeUploadRecommendResponse | null>(null) // 模型推荐结果
const selectedDocumentType = ref('') // 用户最终选择的文档结构
const selectedSplitStrategy = ref('') // 用户最终选择的切分策略
const selectedUploadCollection = ref('agent') // 上传文件写入的 collection
const knowledgePreviewVisible = ref(false) // 文件预览弹窗开关
const knowledgePreviewLoading = ref(false) // 文件预览加载状态
const knowledgePreview = ref<KnowledgeFilePreviewResponse | null>(null) // 文件预览内容

const dictionaryDialogVisible = ref(false) // 字典表管理弹窗开关
const dictionaryLoading = ref(false) // 字典表加载状态
const activeDictionaryCode = ref('') // 当前进入详情的父级字典编码
const dictionaryPage = ref(1) // 父级字典分页页码
const dictionaryPageSize = 8 // 父级字典每页展示数量
const dictionaryGroupDialogVisible = ref(false) // 父级字典编辑弹窗开关
const dictionaryGroupSaving = ref(false) // 父级字典保存状态
const dictionaryItemDialogVisible = ref(false) // 字典项编辑弹窗开关
const dictionaryItemSaving = ref(false) // 字典项保存状态
const activeDictionaryAction = ref('') // 当前字典操作 loading key
const editingDictionaryGroupCode = ref('') // 当前正在编辑的父级字典编码
const editingDictionaryItemId = ref('') // 当前正在编辑的字典项 ID
const dictionaryGroupForm = ref<DictionaryGroupFormState>({
  dictionaryCode: '',
  dictionaryName: '',
})
const dictionaryForm = ref<DictionaryFormState>({
  dictionaryCode: '',
  dictionaryName: '',
  itemCode: '',
  itemName: '',
  parentItemId: '',
  sortOrder: 0,
  enabled: true,
  description: '',
  metadataText: '{}',
})

const indexedCount = computed(() => knowledgeFiles.value.filter((item) => item.status === 'indexed').length)
const collectionCount = computed(() => new Set([...(health.value?.collections || []), ...knowledgeFiles.value.map((item) => item.collection_name)]).size)
const totalVectorPointCount = computed(() => Object.values(health.value?.collection_points || {}).reduce((total, count) => total + Number(count || 0), 0))
const dictionaryItemCount = computed(() => dictionaries.value.reduce((total, group) => total + countItems(group.items), 0))
const latestConversation = computed(() => conversations.value[0])

const cockpitCards = computed(() => [
  { title: '服务健康', value: serviceStatusLabel(health.value?.status), detail: `Qdrant ${serviceStatusLabel(health.value?.qdrant)}`, icon: ShieldCheck, tone: health.value?.status === 'ok' ? 'good' : 'warn' },
  { title: '知识矩阵', value: `${indexedCount.value}/${knowledgeFiles.value.length}`, detail: `已索引 / 文件总数，向量 ${totalVectorPointCount.value}`, icon: DatabaseZap, tone: 'blue' },
  { title: '多库航道', value: collectionCount.value || 0, detail: '可用知识库 Collection', icon: Boxes, tone: 'cyan' },
  { title: '字典引擎', value: dictionaries.value.length, detail: `${dictionaryItemCount.value} 个字典项`, icon: FileText, tone: 'violet' },
  { title: '会话星轨', value: conversationTotal.value, detail: latestConversation.value?.title || '暂无最近会话', icon: Clock3, tone: 'amber' },
])

const collectionOptions = computed(() => { // 汇总健康检查和文件列表中的 collection，供上传与页签共用
  const names = new Set<string>([health.value?.collection_name || 'agent'])
  for (const collectionName of health.value?.collections || []) {
    if (collectionName) names.add(collectionName)
  }
  for (const file of knowledgeFiles.value) {
    if (file.collection_name) names.add(file.collection_name)
  }
  return Array.from(names).sort((left, right) => left.localeCompare(right))
})

const knowledgeFilesInActiveCollection = computed(() => { // 先按当前 collection 页签过滤知识库文件
  if (!activeKnowledgeCollection.value) return knowledgeFiles.value
  return knowledgeFiles.value.filter((file) => file.collection_name === activeKnowledgeCollection.value)
})

const filteredKnowledgeFiles = computed(() => { // 再按文件名关键词过滤知识库文件
  const keyword = knowledgeKeyword.value.trim().toLowerCase()
  if (!keyword) return knowledgeFilesInActiveCollection.value
  return knowledgeFilesInActiveCollection.value.filter((file) => file.filename.toLowerCase().includes(keyword))
})

const pagedKnowledgeFiles = computed(() => { // 当前页展示的 9 个知识库文件
  const start = (knowledgePage.value - 1) * knowledgePageSize
  return filteredKnowledgeFiles.value.slice(start, start + knowledgePageSize)
})

const activeIndexedKnowledgeCount = computed(() => ( // 当前 collection 下已经索引成功的文件数
  knowledgeFilesInActiveCollection.value.filter((file) => file.status === 'indexed').length
))

const knowledgeCollectionTabs = computed(() => ( // 知识库弹窗页签统计
  collectionOptions.value.map((collectionName) => {
    const files = knowledgeFiles.value.filter((file) => file.collection_name === collectionName)
    return {
      collectionName,
      total: files.length,
      indexed: files.filter((file) => file.status === 'indexed').length,
      points: Number(health.value?.collection_points?.[collectionName] || 0),
    }
  })
))

const overviewKnowledgeFiles = computed(() => { // 首页概览按当前向量库过滤文件
  if (!overviewActiveCollection.value) return knowledgeFiles.value
  return knowledgeFiles.value.filter((file) => file.collection_name === overviewActiveCollection.value)
})

const overviewActiveCollectionPoints = computed(() => (
  Number(health.value?.collection_points?.[overviewActiveCollection.value] || 0)
))

const overviewPagedKnowledgeFiles = computed(() => { // 首页概览当前页文件
  const start = (overviewKnowledgePage.value - 1) * overviewKnowledgePageSize
  return overviewKnowledgeFiles.value.slice(start, start + overviewKnowledgePageSize)
})

const overviewCollectionTabs = computed(() => ( // 首页向量库页签统计
  knowledgeCollectionTabs.value.map((tab) => ({
    ...tab,
    active: overviewActiveCollection.value === tab.collectionName,
  }))
))

const overviewPagedConversations = computed(() => { // 首页最近会话当前页数据
  const start = (overviewConversationPage.value - 1) * overviewConversationPageSize
  return conversations.value.slice(start, start + overviewConversationPageSize)
})

const pagedDictionaryGroups = computed(() => { // 父级字典分页结果
  const start = (dictionaryPage.value - 1) * dictionaryPageSize
  return dictionaries.value.slice(start, start + dictionaryPageSize)
})

const activeDictionaryGroup = computed(() => ( // 当前正在查看详情的父级字典
  dictionaries.value.find((group) => group.dictionary_code === activeDictionaryCode.value) || null
))

watch(knowledgeKeyword, () => { // 搜索条件变化时回到知识库第一页
  knowledgePage.value = 1
})

watch(activeKnowledgeCollection, () => { // 切换 collection 时回到知识库第一页
  knowledgePage.value = 1
})

watch(collectionOptions, (collections) => { // 确保知识库弹窗始终选中一个有效 collection
  if (!collections.length) {
    activeKnowledgeCollection.value = ''
    overviewActiveCollection.value = ''
    return
  }
  if (!activeKnowledgeCollection.value || !collections.includes(activeKnowledgeCollection.value)) {
    activeKnowledgeCollection.value = collections[0]
  }
  if (!overviewActiveCollection.value || !collections.includes(overviewActiveCollection.value)) {
    overviewActiveCollection.value = collections[0]
  }
}, { immediate: true })

watch(overviewActiveCollection, () => { // 首页切换向量库时回到第一页
  overviewKnowledgePage.value = 1
})

watch(overviewKnowledgeFiles, (files) => { // 文件刷新后修正首页概览页码
  const maxPage = Math.max(1, Math.ceil(files.length / overviewKnowledgePageSize))
  overviewKnowledgePage.value = Math.min(overviewKnowledgePage.value, maxPage)
})

watch(conversations, (items) => { // 会话刷新后修正首页最近会话页码
  const maxPage = Math.max(1, Math.ceil(items.length / overviewConversationPageSize))
  overviewConversationPage.value = Math.min(overviewConversationPage.value, maxPage)
})

watch(dictionaries, () => { // 字典刷新后修正详情页和分页状态
  if (activeDictionaryCode.value && !dictionaries.value.some((group) => group.dictionary_code === activeDictionaryCode.value)) {
    activeDictionaryCode.value = ''
  }
  const maxPage = Math.max(1, Math.ceil(dictionaries.value.length / dictionaryPageSize))
  dictionaryPage.value = Math.min(dictionaryPage.value, maxPage)
})

function flattenDictionaryItems(items: DictionaryItemResponse[]): DictionaryItemResponse[] { // 把多层级字典项拉平成列表
  return items.flatMap((item) => [item, ...flattenDictionaryItems(item.children || [])])
}

function dictionaryItems(dictionaryCode: string) { // 按字典编码读取启用字典项
  const group = dictionaries.value.find((item) => item.dictionary_code === dictionaryCode)
  return flattenDictionaryItems(group?.items || []).filter((item) => item.enabled)
}

function dictionaryDefaultCode(dictionaryCode: string) { // 获取某组字典默认项，默认取排序最靠前的启用项
  return dictionaryItems(dictionaryCode)[0]?.item_code || ''
}

function dictionaryCodeByMetadata(dictionaryCode: string, key: string, value: unknown) { // 按 metadata 查找具有业务含义的字典项编码
  return dictionaryItems(dictionaryCode).find((item) => item.metadata?.[key] === value)?.item_code || ''
}

function countItems(items: DictionaryGroupResponse['items']): number { // 统计字典树全部节点数量
  return items.reduce((total, item) => total + 1 + countItems(item.children || []), 0)
}

function dictionaryGroupItemCount(group: DictionaryGroupResponse) { // 统计单个父级字典下的全部字典项数量
  return flattenDictionaryItems(group.items).length
}

function serviceStatusLabel(status?: string) { // 把服务状态编码转换成中文文案
  if (status === 'ok') return '正常'
  if (status === 'degraded') return '降级'
  if (status === 'unavailable') return '不可用'
  return '未知'
}

function knowledgeStatusType(status: string) { // 把知识库文件状态转换成 Element Plus 标签类型
  const item = dictionaryItems('document_status').find((option) => option.item_code === status)
  return String(item?.metadata?.tag_type || 'info')
}

function isKnowledgeResultStatus(status: string, metadataKey: string, metadataValue: unknown) { // 判断知识库操作结果是否匹配某个字典元数据
  const targetCode = dictionaryCodeByMetadata('knowledge_result_status', metadataKey, metadataValue)
  return Boolean(targetCode) && status === targetCode
}

function previewTypeLabel(previewType: string) { // 把文件预览类型编码转换成中文文案
  return dictionaryItems('preview_type').find((item) => item.item_code === previewType)?.item_name || previewType
}

function formatFileSize(size: number) { // 把字节数格式化成页面易读文本
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(value?: string | null) { // 格式化后端 ISO 时间
  if (!value) return '暂无'
  return value.replace('T', ' ').slice(0, 19)
}

function conversationFallbackTitle(conversation: ConversationSummaryResponse) {
  return conversation.title || '未命名会话'
}

function conversationTooltipContent(conversation: ConversationSummaryResponse) {
  return conversationTooltipMap.value[conversation.conversation_id] || conversationFallbackTitle(conversation)
}

function openConversationHistory(conversation: ConversationSummaryResponse) {
  emit('openChatHistory', conversation.conversation_id)
}

async function loadConversationTooltip(conversation: ConversationSummaryResponse) {
  if (conversationTooltipMap.value[conversation.conversation_id]) return
  try {
    const detail = await getConversationDetail(conversation.conversation_id)
    const userMessage = detail.messages.find((message) => message.role === 'user' && message.content.trim())
    conversationTooltipMap.value[conversation.conversation_id] = userMessage?.content.trim() || conversationFallbackTitle(conversation)
  } catch {
    conversationTooltipMap.value[conversation.conversation_id] = conversationFallbackTitle(conversation)
  }
}

function knowledgeActionKey(action: string, documentId: string) { // 拼接知识库文件操作唯一 key
  return `${action}:${documentId}`
}

function dictionaryActionKey(action: string, dictionaryItemId: string) { // 拼接字典项操作唯一 key
  return `${action}:${dictionaryItemId}`
}

async function confirmDangerOnce(message: string, title: string, confirmButtonText = '确认删除') { // 删除和重建类操作统一确认
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText,
      cancelButtonText: '取消',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

async function refreshDashboard() { // 刷新首页所有总览数据
  loading.value = true
  // 首页只做总览展示，单个接口变慢或失败时不应该阻塞整页渲染。
  const [healthResult, filesResult, dictionaryResult, conversationResult] = await Promise.allSettled([
    fetchHealth(),
    listKnowledgeFiles(),
    listDictionaries(),
    listConversations(1, 30),
  ])

  try {
    if (healthResult.status === 'fulfilled') {
      health.value = healthResult.value
      selectedUploadCollection.value ||= healthResult.value.collection_name || 'agent'
    }
    if (filesResult.status === 'fulfilled') {
      knowledgeFiles.value = filesResult.value
    }
    if (dictionaryResult.status === 'fulfilled') {
      dictionaries.value = dictionaryResult.value
      selectedDocumentType.value ||= dictionaryDefaultCode('document_structure')
      selectedSplitStrategy.value ||= dictionaryDefaultCode('split_strategy')
    }
    if (conversationResult.status === 'fulfilled') {
      conversations.value = conversationResult.value.items
      conversationTotal.value = conversationResult.value.total
    }

    const failedCount = [healthResult, filesResult, dictionaryResult, conversationResult]
      .filter((result) => result.status === 'rejected')
      .length
    if (failedCount > 0) {
      ElMessage.warning(`首页有 ${failedCount} 个数据接口加载失败，已先展示可用数据`)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '首页数据刷新失败')
  } finally {
    loading.value = false
  }
}

async function refreshKnowledgeFiles() { // 刷新知识库文件列表
  knowledgeLoading.value = true
  try {
    knowledgeFiles.value = await listKnowledgeFiles()
    const maxPage = Math.max(1, Math.ceil(filteredKnowledgeFiles.value.length / knowledgePageSize))
    knowledgePage.value = Math.min(knowledgePage.value, maxPage)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识库文件列表加载失败')
  } finally {
    knowledgeLoading.value = false
  }
}

async function refreshDictionaries() { // 刷新字典表并同步上传配置默认值
  dictionaryLoading.value = true
  try {
    dictionaries.value = await listDictionaries()
    selectedDocumentType.value ||= dictionaryDefaultCode('document_structure')
    selectedSplitStrategy.value ||= dictionaryDefaultCode('split_strategy')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典表加载失败')
  } finally {
    dictionaryLoading.value = false
  }
}

async function refreshHealth() { // 刷新后端健康检查
  try {
    health.value = await fetchHealth()
  } catch {
    health.value = {
      status: 'degraded',
      qdrant: 'unavailable',
      collection_name: 'agent',
      collections: [],
      collection_points: {},
    }
  }
}

async function openKnowledgeDialog() { // 打开知识库管理弹窗
  knowledgeDialogVisible.value = true
  await refreshKnowledgeFiles()
}

async function openDictionaryDialog() { // 打开字典表管理弹窗
  dictionaryDialogVisible.value = true
  await refreshDictionaries()
}

function openKnowledgeFilePicker() { // 打开本地文件选择框
  knowledgeFileInput.value?.click()
}

async function handleKnowledgeFileChange(event: Event) { // 选择文件后先上传到临时区做预解析
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingKnowledge.value = true
  try {
    const response = await previewKnowledgeFile(file)
    if (response.duplicate) {
      ElMessage.info('当前已有相同内容文件，也可以选择新 Collection 后继续入库')
    }
    uploadPreview.value = response
    uploadRecommendation.value = null
    selectedDocumentType.value = response.detected_type
    selectedSplitStrategy.value = response.split_strategy
    selectedUploadCollection.value = activeKnowledgeCollection.value || health.value?.collection_name || 'agent'
    uploadPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件预解析失败')
  } finally {
    uploadingKnowledge.value = false
    target.value = ''
  }
}

async function handleRecommendKnowledgeUpload() { // 调用模型推荐上传文件的结构和切分策略
  if (!uploadPreview.value || recommendingKnowledge.value) return

  recommendingKnowledge.value = true
  try {
    const recommendation = await recommendKnowledgeUpload(uploadPreview.value.upload_id)
    uploadRecommendation.value = recommendation
    selectedDocumentType.value = recommendation.document_type
    selectedSplitStrategy.value = recommendation.split_strategy
    ElMessage.success('已采用模型推荐的切分方式')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '模型推荐失败')
  } finally {
    recommendingKnowledge.value = false
  }
}

async function handleConfirmKnowledgeUpload() { // 用户确认后把临时上传文件正式写入知识库
  if (!uploadPreview.value || confirmingKnowledge.value) return

  confirmingKnowledge.value = true
  try {
    const response = await confirmKnowledgeUpload(
      uploadPreview.value.upload_id,
      selectedDocumentType.value,
      selectedSplitStrategy.value,
      selectedUploadCollection.value,
    )
    if (isKnowledgeResultStatus(response.status, 'result_kind', 'duplicate')) {
      ElMessage.info(response.message || '相同内容的文件已经存在')
    } else {
      ElMessage.success(response.message || '文件已写入知识库')
    }
    uploadPreviewVisible.value = false
    uploadPreview.value = null
    uploadRecommendation.value = null
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件入库失败')
  } finally {
    confirmingKnowledge.value = false
  }
}

async function handlePreviewKnowledgeFile(file: KnowledgeFileResponse) { // 打开单个知识库文件预览
  const actionKey = knowledgeActionKey('preview', file.document_id)
  knowledgePreviewVisible.value = true
  knowledgePreviewLoading.value = true
  knowledgePreview.value = null
  activeKnowledgeAction.value = actionKey

  try {
    knowledgePreview.value = await previewKnowledgeDocument(file.document_id)
  } catch (error) {
    knowledgePreviewVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '文件预览失败')
  } finally {
    knowledgePreviewLoading.value = false
    if (activeKnowledgeAction.value === actionKey) {
      activeKnowledgeAction.value = ''
    }
  }
}

async function handleReindexKnowledgeFile(file: KnowledgeFileResponse) { // 重新索引单个知识库文件
  const confirmed = await confirmDangerOnce(`确定重新索引「${file.filename}」吗？`, '重新索引', '重新索引')
  if (!confirmed) return

  activeKnowledgeAction.value = knowledgeActionKey('reindex', file.document_id)
  try {
    await reindexKnowledgeFile(file.document_id)
    ElMessage.success('已重新索引')
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新索引失败')
  } finally {
    activeKnowledgeAction.value = ''
  }
}

async function handleReindexAllKnowledgeFiles() { // 清空旧向量并重新索引全部知识库文件
  const confirmed = await confirmDangerOnce(
    '确定清空旧向量并重新索引全部知识库文件吗？这个操作会重新生成向量，文件多时会比较慢。',
    '清空并重建',
    '清空并重建',
  )
  if (!confirmed) return

  reindexingAll.value = true
  try {
    const response = await reindexAllKnowledgeFiles()
    if (response.failed > 0) {
      ElMessage.warning(`重建完成：成功 ${response.succeeded} 个，失败 ${response.failed} 个`)
    } else {
      ElMessage.success(`全部重建完成：${response.succeeded} 个文件`)
    }
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清空并重建失败')
  } finally {
    reindexingAll.value = false
  }
}

async function handleDeleteKnowledgeFile(file: KnowledgeFileResponse) { // 删除单个知识库文件
  const confirmed = await confirmDangerOnce(`确定删除「${file.filename}」吗？`, '删除知识库文件', '删除')
  if (!confirmed) return

  activeKnowledgeAction.value = knowledgeActionKey('delete', file.document_id)
  try {
    await deleteKnowledgeFile(file.document_id)
    ElMessage.success('已删除知识库文件')
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    activeKnowledgeAction.value = ''
  }
}

function openDictionaryGroup(group: DictionaryGroupResponse) { // 进入父级字典详情
  activeDictionaryCode.value = group.dictionary_code
}

function backToDictionaryGroups() { // 返回父级字典列表
  activeDictionaryCode.value = ''
}

function handleDictionaryPageChange(page: number) { // 父级字典分页切换
  dictionaryPage.value = page
}

function openCreateDictionaryGroupDialog() { // 打开新增父级字典弹窗
  editingDictionaryGroupCode.value = ''
  dictionaryGroupForm.value = {
    dictionaryCode: '',
    dictionaryName: '',
  }
  dictionaryGroupDialogVisible.value = true
}

function openEditDictionaryGroupDialog(group: DictionaryGroupResponse) { // 打开修改父级字典弹窗
  editingDictionaryGroupCode.value = group.dictionary_code
  dictionaryGroupForm.value = {
    dictionaryCode: group.dictionary_code,
    dictionaryName: group.dictionary_name,
  }
  dictionaryGroupDialogVisible.value = true
}

async function saveDictionaryGroup() { // 保存父级字典
  if (dictionaryGroupSaving.value) return
  const form = dictionaryGroupForm.value
  if (!form.dictionaryCode.trim() || !form.dictionaryName.trim()) {
    ElMessage.warning('请填写父级字典编码和名称')
    return
  }

  dictionaryGroupSaving.value = true
  try {
    if (editingDictionaryGroupCode.value) {
      await updateDictionaryGroup(editingDictionaryGroupCode.value, {
        dictionary_name: form.dictionaryName.trim(),
      })
      ElMessage.success('父级字典已修改')
    } else {
      await createDictionaryGroup({
        dictionary_code: form.dictionaryCode.trim(),
        dictionary_name: form.dictionaryName.trim(),
      })
      ElMessage.success('父级字典已新增')
    }
    dictionaryGroupDialogVisible.value = false
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '父级字典保存失败')
  } finally {
    dictionaryGroupSaving.value = false
  }
}

function dictionaryParentOptions() { // 当前父级字典下可选择的父节点
  return activeDictionaryGroup.value ? flattenDictionaryItems(activeDictionaryGroup.value.items) : []
}

function resetDictionaryForm(group?: DictionaryGroupResponse) { // 重置字典项表单
  dictionaryForm.value = {
    dictionaryCode: group?.dictionary_code || '',
    dictionaryName: group?.dictionary_name || '',
    itemCode: '',
    itemName: '',
    parentItemId: '',
    sortOrder: 0,
    enabled: true,
    description: '',
    metadataText: '{}',
  }
  editingDictionaryItemId.value = ''
}

function openCreateDictionaryItemDialog() { // 打开新增字典项弹窗
  resetDictionaryForm(activeDictionaryGroup.value || undefined)
  dictionaryItemDialogVisible.value = true
}

function openEditDictionaryItemDialog(item: DictionaryItemResponse) { // 打开修改字典项弹窗
  editingDictionaryItemId.value = item.dictionary_item_id
  dictionaryForm.value = {
    dictionaryCode: item.dictionary_code,
    dictionaryName: item.dictionary_name,
    itemCode: item.item_code,
    itemName: item.item_name,
    parentItemId: item.parent_item_id || '',
    sortOrder: item.sort_order,
    enabled: item.enabled,
    description: item.description || '',
    metadataText: JSON.stringify(item.metadata || {}, null, 2),
  }
  dictionaryItemDialogVisible.value = true
}

function parseDictionaryMetadata() { // 解析字典项扩展元数据
  const rawText = dictionaryForm.value.metadataText.trim()
  if (!rawText) return {}
  const parsed = JSON.parse(rawText)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('扩展元数据必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

async function saveDictionaryItem() { // 保存新增或修改后的字典项
  if (dictionaryItemSaving.value) return
  const form = dictionaryForm.value
  if (!form.dictionaryCode.trim() || !form.dictionaryName.trim() || !form.itemCode.trim() || !form.itemName.trim()) {
    ElMessage.warning('请填写字典编码、字典名称、项编码和项名称')
    return
  }

  dictionaryItemSaving.value = true
  try {
    const payload = {
      dictionary_code: form.dictionaryCode.trim(),
      dictionary_name: form.dictionaryName.trim(),
      item_code: form.itemCode.trim(),
      item_name: form.itemName.trim(),
      parent_item_id: form.parentItemId || null,
      sort_order: Number(form.sortOrder) || 0,
      enabled: form.enabled,
      description: form.description.trim() || null,
      metadata: parseDictionaryMetadata(),
    }
    if (editingDictionaryItemId.value) {
      await updateDictionaryItem(editingDictionaryItemId.value, payload)
      ElMessage.success('字典项已修改')
    } else {
      await createDictionaryItem(payload)
      ElMessage.success('字典项已新增')
    }
    dictionaryItemDialogVisible.value = false
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典项保存失败')
  } finally {
    dictionaryItemSaving.value = false
  }
}

async function toggleDictionaryItemEnabled(item: DictionaryItemResponse) { // 启用或禁用字典项
  const nextEnabled = !item.enabled
  activeDictionaryAction.value = dictionaryActionKey('enabled', item.dictionary_item_id)
  try {
    await setDictionaryItemEnabled(item.dictionary_item_id, nextEnabled)
    ElMessage.success(nextEnabled ? '字典项已启用' : '字典项已禁用')
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '启用状态更新失败')
  } finally {
    activeDictionaryAction.value = ''
  }
}

async function handleDeleteDictionaryItem(item: DictionaryItemResponse) { // 删除字典项
  const confirmed = await confirmDangerOnce(
    `确定删除字典项「${item.item_name}」吗？存在子级时需要先删除子级。`,
    '删除字典项',
    '删除',
  )
  if (!confirmed) return

  activeDictionaryAction.value = dictionaryActionKey('delete', item.dictionary_item_id)
  try {
    await deleteDictionaryItem(item.dictionary_item_id)
    ElMessage.success('字典项已删除')
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典项删除失败')
  } finally {
    activeDictionaryAction.value = ''
  }
}

async function handleDeleteDictionaryGroup(group: DictionaryGroupResponse) { // 删除父级字典及其全部子项
  const confirmed = await confirmDangerOnce(
    `确定删除父级字典「${group.dictionary_name}」吗？这会删除 ${dictionaryGroupItemCount(group)} 个字典项，无法撤销。`,
    '删除父级字典',
    '删除父级',
  )
  if (!confirmed) return

  activeDictionaryAction.value = `group:${group.dictionary_code}`
  try {
    await deleteDictionaryGroup(group.dictionary_code)
    ElMessage.success('父级字典已删除')
    if (activeDictionaryCode.value === group.dictionary_code) {
      activeDictionaryCode.value = ''
    }
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '父级字典删除失败')
  } finally {
    activeDictionaryAction.value = ''
  }
}

onMounted(() => {
  void refreshDashboard()
})
</script>

<template>
  <div class="dashboard-page">
    <input
      ref="knowledgeFileInput"
      class="hidden-file-input"
      type="file"
      accept=".txt,.pdf"
      @change="handleKnowledgeFileChange"
    >

    <header class="page-hero">
      <div>
        <span class="page-kicker"><Activity :size="16" /> 系统驾驶舱</span>
        <h2>知识服务总览</h2>
        <p>集中维护知识库、字典表、服务状态与接口配置，智能客服页面只负责问答。</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button class="tech-button primary" :icon="DatabaseZap" @click="openKnowledgeDialog">知识库管理</el-button>
        <el-button class="tech-button" :icon="FileText" @click="openDictionaryDialog">字典表管理</el-button>
        <el-button class="tech-button" :icon="RefreshCw" :loading="loading" @click="refreshDashboard">刷新状态</el-button>
      </div>
    </header>

    <section class="cockpit-grid">
      <article v-for="card in cockpitCards" :key="card.title" class="cockpit-card" :class="`tone-${card.tone}`">
        <span class="cockpit-icon"><component :is="card.icon" :size="22" /></span>
        <div>
          <strong>{{ card.value }}</strong>
          <h3>{{ card.title }}</h3>
          <p>{{ card.detail }}</p>
        </div>
      </article>
    </section>

    <section class="dashboard-panels">
      <article class="dashboard-panel">
        <div class="panel-title panel-title-between">
          <span><DatabaseZap :size="18" />知识库概览</span>
          <em>{{ overviewKnowledgeFiles.length }} 个文件 / {{ overviewActiveCollectionPoints }} 个向量</em>
        </div>
        <div class="overview-collection-tabs" role="tablist" aria-label="首页向量库列表">
          <button
            v-for="tab in overviewCollectionTabs"
            :key="tab.collectionName"
            type="button"
            class="overview-collection-tab"
            :class="{ active: tab.active }"
            role="tab"
            :aria-selected="tab.active"
            @click="overviewActiveCollection = tab.collectionName"
          >
            <span class="overview-collection-name">{{ tab.collectionName }}</span>
            <span class="overview-collection-stats">
              <em>文件 {{ tab.indexed }}/{{ tab.total }}</em>
              <em>向量 {{ tab.points }}</em>
            </span>
          </button>
        </div>
        <div class="data-table-lite dashboard-knowledge-table">
          <div v-for="file in overviewPagedKnowledgeFiles" :key="file.document_id">
            <el-tooltip :content="file.filename" placement="top" popper-class="smart-tooltip" teleported>
              <span>{{ file.filename }}</span>
            </el-tooltip>
            <el-tooltip :content="`${file.collection_name} / ${file.status}`" placement="top" popper-class="smart-tooltip" teleported>
              <em>{{ file.collection_name }} / {{ file.status }}</em>
            </el-tooltip>
          </div>
          <p v-if="knowledgeFiles.length === 0 && overviewActiveCollectionPoints === 0" class="overview-empty-state">暂无知识库文件</p>
          <p v-else-if="overviewKnowledgeFiles.length === 0 && overviewActiveCollectionPoints > 0" class="overview-empty-state">
            当前向量库有 {{ overviewActiveCollectionPoints }} 个向量点，但没有普通知识库文件记录，可能是销售训练库或其他专用库。
          </p>
          <p v-else-if="overviewKnowledgeFiles.length === 0" class="overview-empty-state">当前向量库暂无文件</p>
        </div>
        <el-pagination
          v-if="overviewKnowledgeFiles.length > 0"
          v-model:current-page="overviewKnowledgePage"
          class="dashboard-mini-pagination"
          small
          background
          layout="prev, pager, next"
          :page-size="overviewKnowledgePageSize"
          :total="overviewKnowledgeFiles.length"
        />
      </article>
      <article class="dashboard-panel">
        <div class="panel-title panel-title-between">
          <span><Clock3 :size="18" />最近会话</span>
          <em>{{ conversationTotal }} 条记录</em>
        </div>
        <div class="recent-conversation-strip" aria-label="最近会话概览">
          <span>最近</span>
          <em>{{ overviewConversationPageSize }} 条/页</em>
        </div>
        <div class="data-table-lite">
          <div
            v-for="conversation in overviewPagedConversations"
            :key="conversation.conversation_id"
            class="clickable-data-row"
            role="button"
            tabindex="0"
            @click="openConversationHistory(conversation)"
            @keydown.enter="openConversationHistory(conversation)"
          >
            <el-tooltip :content="conversationTooltipContent(conversation)" placement="top" popper-class="smart-tooltip" teleported>
              <span @mouseenter="loadConversationTooltip(conversation)">
                {{ conversationFallbackTitle(conversation) }}
              </span>
            </el-tooltip>
            <el-tooltip :content="formatDateTime(conversation.last_message_at || conversation.updated_at)" placement="top" popper-class="smart-tooltip" teleported>
              <em>{{ formatDateTime(conversation.last_message_at || conversation.updated_at) }}</em>
            </el-tooltip>
          </div>
          <p v-if="conversations.length === 0">暂无聊天记录</p>
        </div>
        <el-pagination
          v-if="conversations.length > 0"
          v-model:current-page="overviewConversationPage"
          class="dashboard-mini-pagination"
          small
          background
          layout="prev, pager, next"
          :page-size="overviewConversationPageSize"
          :total="conversations.length"
        />
      </article>
    </section>

    <el-dialog
      v-model="knowledgeDialogVisible"
      title="知识库管理"
      width="1180px"
      class="knowledge-dialog"
    >
      <div class="dialog-toolbar">
        <div class="dialog-toolbar-main">
          <div>
            <strong>{{ filteredKnowledgeFiles.length }}</strong>
            <span>个文件</span>
            <em>{{ activeIndexedKnowledgeCount }} 个已索引</em>
          </div>
          <el-input
            v-model="knowledgeKeyword"
            class="dialog-search-input"
            clearable
            :prefix-icon="Search"
            placeholder="按文件名模糊查询"
          />
        </div>
        <div class="dialog-actions">
          <el-button :icon="Upload" :loading="uploadingKnowledge" type="primary" @click="openKnowledgeFilePicker">
            上传文件
          </el-button>
          <el-button :icon="RefreshCw" :loading="knowledgeLoading" @click="refreshKnowledgeFiles">
            刷新
          </el-button>
          <el-button :icon="RefreshCw" :loading="reindexingAll" type="warning" plain @click="handleReindexAllKnowledgeFiles">
            清空并重建
          </el-button>
        </div>
      </div>

      <div class="knowledge-collection-tabs" role="tablist" aria-label="知识库列表">
        <button
          v-for="tab in knowledgeCollectionTabs"
          :key="tab.collectionName"
          type="button"
          class="knowledge-collection-tab"
          :class="{ active: activeKnowledgeCollection === tab.collectionName }"
          role="tab"
          :aria-selected="activeKnowledgeCollection === tab.collectionName"
          @click="activeKnowledgeCollection = tab.collectionName"
        >
          <span>{{ tab.collectionName }}</span>
          <em>{{ tab.indexed }}/{{ tab.total }} 已索引</em>
        </button>
      </div>

      <div v-loading="knowledgeLoading" class="knowledge-dialog-body">
        <div v-if="knowledgeFiles.length === 0" class="empty-knowledge">暂无知识库文件</div>
        <div v-else-if="filteredKnowledgeFiles.length === 0" class="empty-knowledge">没有匹配的知识库文件</div>
        <div v-else class="knowledge-grid">
          <article v-for="file in pagedKnowledgeFiles" :key="file.document_id" class="knowledge-file">
            <div class="knowledge-file-main">
              <FileText :size="18" />
              <div class="knowledge-file-info">
                <strong>{{ file.filename }}</strong>
                <span>{{ file.file_type.toUpperCase() }} · {{ formatFileSize(file.file_size) }} · {{ file.chunk_count }} chunks</span>
              </div>
              <el-tag :type="knowledgeStatusType(file.status)" effect="plain" size="small">
                {{ file.status }}
              </el-tag>
            </div>
            <div class="knowledge-file-meta">
              <span>版本 v{{ file.version }}</span>
              <span>{{ formatDateTime(file.updated_at) }}</span>
            </div>
            <div v-if="file.error_message" class="knowledge-error">{{ file.error_message }}</div>
            <div class="knowledge-file-actions">
              <el-button
                :icon="Eye"
                size="small"
                :loading="activeKnowledgeAction === knowledgeActionKey('preview', file.document_id)"
                :disabled="Boolean(activeKnowledgeAction)"
                @click="handlePreviewKnowledgeFile(file)"
              >
                预览
              </el-button>
              <el-button
                :icon="RefreshCw"
                size="small"
                :loading="activeKnowledgeAction === knowledgeActionKey('reindex', file.document_id)"
                :disabled="Boolean(activeKnowledgeAction)"
                @click="handleReindexKnowledgeFile(file)"
              >
                重建
              </el-button>
              <el-button
                :icon="Trash2"
                plain
                size="small"
                type="danger"
                :loading="activeKnowledgeAction === knowledgeActionKey('delete', file.document_id)"
                :disabled="Boolean(activeKnowledgeAction)"
                @click="handleDeleteKnowledgeFile(file)"
              >
                删除
              </el-button>
            </div>
          </article>
        </div>
      </div>

      <template #footer>
        <el-pagination
          v-model:current-page="knowledgePage"
          background
          layout="prev, pager, next"
          :page-size="knowledgePageSize"
          :total="filteredKnowledgeFiles.length"
        />
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryDialogVisible"
      title="字典表"
      width="1080px"
      class="dictionary-dialog"
    >
      <div class="dialog-toolbar">
        <div class="dialog-toolbar-main">
          <div>
            <strong>{{ activeDictionaryGroup ? activeDictionaryGroup.dictionary_name : dictionaries.length }}</strong>
            <span>{{ activeDictionaryGroup ? activeDictionaryGroup.dictionary_code : '组字典' }}</span>
            <em>{{ activeDictionaryGroup ? `${dictionaryGroupItemCount(activeDictionaryGroup)} 个字典项` : '点击父级字典进入子集' }}</em>
          </div>
        </div>
        <div class="dialog-actions">
          <el-button v-if="activeDictionaryGroup" :icon="ArrowLeft" @click="backToDictionaryGroups">返回父级</el-button>
          <el-button v-if="!activeDictionaryGroup" type="primary" @click="openCreateDictionaryGroupDialog">新增父级</el-button>
          <el-button v-if="activeDictionaryGroup" type="primary" @click="openCreateDictionaryItemDialog">新增字典项</el-button>
          <el-button
            v-if="activeDictionaryGroup"
            :icon="Trash2"
            plain
            type="danger"
            :loading="activeDictionaryAction === `group:${activeDictionaryGroup.dictionary_code}`"
            @click="handleDeleteDictionaryGroup(activeDictionaryGroup)"
          >
            删除父级
          </el-button>
          <el-button :icon="RefreshCw" :loading="dictionaryLoading" @click="refreshDictionaries">刷新</el-button>
        </div>
      </div>

      <div v-loading="dictionaryLoading" class="dictionary-dialog-body">
        <div v-if="dictionaries.length === 0" class="empty-knowledge">暂无字典项</div>
        <template v-else-if="!activeDictionaryGroup">
          <div class="dictionary-parent-grid">
            <button
              v-for="group in pagedDictionaryGroups"
              :key="group.dictionary_code"
              type="button"
              class="dictionary-parent-card"
              @click="openDictionaryGroup(group)"
            >
              <span class="dictionary-parent-icon"><DatabaseZap :size="18" /></span>
              <span class="dictionary-parent-content">
                <strong>{{ group.dictionary_name }}</strong>
                <code>{{ group.dictionary_code }}</code>
                <em>{{ dictionaryGroupItemCount(group) }} 个字典项</em>
              </span>
              <span class="dictionary-parent-actions">
                <el-button :icon="Pencil" circle size="small" @click.stop="openEditDictionaryGroupDialog(group)" />
                <ChevronRight :size="18" />
              </span>
            </button>
          </div>
        </template>
        <section v-else class="dictionary-group">
          <div class="dictionary-group-title">
            <strong>{{ activeDictionaryGroup.dictionary_name }}</strong>
            <code>{{ activeDictionaryGroup.dictionary_code }}</code>
          </div>
          <el-table
            :data="activeDictionaryGroup.items"
            row-key="dictionary_item_id"
            default-expand-all
            :tree-props="{ children: 'children' }"
            size="small"
          >
            <el-table-column prop="item_name" label="名称" min-width="160" />
            <el-table-column prop="item_code" label="编码" min-width="180" />
            <el-table-column prop="item_level" label="层级" width="80" />
            <el-table-column prop="sort_order" label="排序" width="80" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain" size="small">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="260" />
            <el-table-column label="操作" width="230" fixed="right">
              <template #default="{ row }">
                <div class="dictionary-row-actions">
                  <el-button size="small" @click="openEditDictionaryItemDialog(row)">修改</el-button>
                  <el-button
                    size="small"
                    :loading="activeDictionaryAction === dictionaryActionKey('enabled', row.dictionary_item_id)"
                    @click="toggleDictionaryItemEnabled(row)"
                  >
                    {{ row.enabled ? '禁用' : '启用' }}
                  </el-button>
                  <el-button
                    plain
                    size="small"
                    type="danger"
                    :loading="activeDictionaryAction === dictionaryActionKey('delete', row.dictionary_item_id)"
                    @click="handleDeleteDictionaryItem(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>

      <template #footer>
        <el-pagination
          v-if="!activeDictionaryGroup"
          v-model:current-page="dictionaryPage"
          background
          layout="prev, pager, next"
          :page-size="dictionaryPageSize"
          :total="dictionaries.length"
          @current-change="handleDictionaryPageChange"
        />
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryGroupDialogVisible"
      :title="editingDictionaryGroupCode ? '修改父级字典' : '新增父级字典'"
      width="560px"
      class="dictionary-dialog"
    >
      <el-form class="dictionary-form" label-position="top">
        <el-form-item label="父级字典编码">
          <el-input v-model="dictionaryGroupForm.dictionaryCode" :disabled="Boolean(editingDictionaryGroupCode)" placeholder="例如：model_mode" />
        </el-form-item>
        <el-form-item label="父级字典名称">
          <el-input v-model="dictionaryGroupForm.dictionaryName" placeholder="例如：回答模型档位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryGroupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictionaryGroupSaving" @click="saveDictionaryGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryItemDialogVisible"
      :title="editingDictionaryItemId ? '修改字典项' : '新增字典项'"
      width="720px"
      class="dictionary-dialog"
    >
      <el-form class="dictionary-form" label-position="top">
        <div class="dictionary-form-grid">
          <el-form-item label="字典编码">
            <el-input v-model="dictionaryForm.dictionaryCode" :disabled="Boolean(editingDictionaryItemId)" />
          </el-form-item>
          <el-form-item label="字典名称">
            <el-input v-model="dictionaryForm.dictionaryName" />
          </el-form-item>
          <el-form-item label="项编码">
            <el-input v-model="dictionaryForm.itemCode" />
          </el-form-item>
          <el-form-item label="项名称">
            <el-input v-model="dictionaryForm.itemName" />
          </el-form-item>
          <el-form-item label="父级字典项">
            <el-select v-model="dictionaryForm.parentItemId" clearable filterable placeholder="不选择则为一级项">
              <el-option label="无父级" value="" />
              <el-option
                v-for="item in dictionaryParentOptions()"
                :key="item.dictionary_item_id"
                :disabled="item.dictionary_item_id === editingDictionaryItemId"
                :label="`${item.item_name}（${item.item_code}）`"
                :value="item.dictionary_item_id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="dictionaryForm.sortOrder" :min="0" :step="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="dictionaryForm.enabled" active-text="启用" inactive-text="禁用" inline-prompt />
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="dictionaryForm.description" />
          </el-form-item>
        </div>
        <el-form-item label="扩展元数据 JSON">
          <el-input v-model="dictionaryForm.metadataText" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" placeholder='例如：{"default": true}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryItemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictionaryItemSaving" @click="saveDictionaryItem">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="knowledgePreviewVisible"
      title="文件预览"
      width="900px"
      class="knowledge-preview-dialog"
    >
      <div v-loading="knowledgePreviewLoading" class="knowledge-preview">
        <template v-if="knowledgePreview">
          <div class="knowledge-preview-header">
            <div>
              <span>文件</span>
              <strong>{{ knowledgePreview.document.filename }}</strong>
            </div>
            <div>
              <span>类型</span>
              <strong>{{ previewTypeLabel(knowledgePreview.preview_type) }}</strong>
            </div>
            <div>
              <span>大小</span>
              <strong>{{ formatFileSize(knowledgePreview.document.file_size) }}</strong>
            </div>
            <div v-if="knowledgePreview.page_count">
              <span>页数</span>
              <strong>{{ knowledgePreview.page_count }}</strong>
            </div>
          </div>
          <div v-if="knowledgePreview.truncated" class="knowledge-preview-warning">
            内容较长，当前只展示前 {{ knowledgePreview.content.length }} 个字符。
          </div>
          <pre class="knowledge-preview-content">{{ knowledgePreview.content || '没有可预览的文本内容' }}</pre>
        </template>
      </div>
    </el-dialog>

    <el-dialog
      v-model="uploadPreviewVisible"
      title="确认入库配置"
      width="640px"
      class="upload-preview-dialog"
    >
      <div v-if="uploadPreview" class="upload-preview">
        <div class="preview-summary">
          <div>
            <span>文件</span>
            <strong>{{ uploadPreview.filename }}</strong>
          </div>
          <div>
            <span>大小</span>
            <strong>{{ formatFileSize(uploadPreview.file_size) }}</strong>
          </div>
          <div>
            <span>推荐来源</span>
            <strong>{{ uploadRecommendation ? '模型' : '默认' }}</strong>
          </div>
        </div>

        <div class="recommend-toolbar">
          <div>
            <strong>{{ uploadRecommendation ? `模型置信度 ${Math.round(uploadRecommendation.confidence * 100)}%` : '默认使用通用递归切分' }}</strong>
            <span v-if="uploadRecommendation">{{ uploadRecommendation.model_name }} · {{ uploadRecommendation.sample_chars }} 字符样本</span>
            <span v-else>需要更精细切分时，可以让模型读取结构样本后推荐。</span>
          </div>
          <el-button :icon="Bot" :loading="recommendingKnowledge" :disabled="confirmingKnowledge" type="primary" plain @click="handleRecommendKnowledgeUpload">
            模型推荐
          </el-button>
        </div>

        <div class="preview-form">
          <label>
            <span>Collection</span>
            <el-select v-model="selectedUploadCollection" filterable allow-create default-first-option placeholder="选择或输入 Collection">
              <el-option v-for="collectionName in collectionOptions" :key="collectionName" :label="collectionName" :value="collectionName" />
            </el-select>
          </label>
          <label>
            <span>文档结构</span>
            <el-select v-model="selectedDocumentType" placeholder="选择文档结构">
              <el-option v-for="item in dictionaryItems('document_structure')" :key="item.item_code" :label="item.item_name" :value="item.item_code" />
            </el-select>
          </label>
          <label>
            <span>切分策略</span>
            <el-select v-model="selectedSplitStrategy" placeholder="选择切分策略">
              <el-option v-for="item in dictionaryItems('split_strategy')" :key="item.item_code" :label="item.item_name" :value="item.item_code" />
            </el-select>
          </label>
        </div>

        <div class="preview-reasons">
          <span>{{ uploadRecommendation ? '模型推荐原因' : '默认原因' }}</span>
          <p v-for="reason in (uploadRecommendation?.reasons || uploadPreview.reasons)" :key="reason">{{ reason }}</p>
        </div>

        <div class="preview-sample">
          <span>文本预览</span>
          <pre>{{ uploadPreview.sample_text }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button :disabled="confirmingKnowledge" @click="uploadPreviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="confirmingKnowledge" @click="handleConfirmKnowledgeUpload">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>
