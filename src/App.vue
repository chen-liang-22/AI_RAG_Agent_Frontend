<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue' // ref 创建响应式数据；computed 创建派生数据；nextTick 等 DOM 更新；watch 监听主题变化；onMounted 页面挂载后执行
import {
  ArrowLeft, // 返回上一级图标
  Bot, // 机器人图标
  ChevronRight, // 进入详情图标
  Clock3, // 聊天记录图标
  CircleAlert, // 异常状态图标
  CircleCheck, // 正常状态图标
  DatabaseZap, // 知识库图标
  Eye, // 文件预览图标
  FileText, // 文件图标
  FolderOpen, // 打开弹窗图标
  MessageCirclePlus, // 继续聊天图标
  LoaderCircle, // 加载中旋转图标
  MessageSquareText, // 会话详情图标
  Moon, // 深色模式图标
  Pencil, // 修改图标
  RefreshCw, // 刷新图标
  Search, // 搜索/故障排查图标
  Send, // 发送图标
  ShieldCheck, // 服务状态图标
  Square, // 停止生成图标
  Sun, // 浅色模式图标
  Trash2, // 清空对话图标
  Upload, // 上传文件图标
  Wifi, // 接口地址图标
} from 'lucide-vue-next' // lucide 图标库
import { ElMessage, ElMessageBox } from 'element-plus' // Element Plus 的全局消息提示和确认弹窗
import {
  API_BASE_URL, // 当前前端请求后端的基础地址，例如 /api
  confirmKnowledgeUpload, // 确认上传预览结果并正式入库
  createDictionaryGroup, // 新增父级字典
  createDictionaryItem, // 新增字典项
  deleteDictionaryGroup, // 删除父级字典
  deleteDictionaryItem, // 删除字典项
  deleteConversation, // 删除后端聊天记录
  deleteKnowledgeFile, // 删除后端知识库文件
  fetchHealth, // 调用后端健康检查接口
  getConversationDetail, // 查询聊天记录详情
  listConversations, // 分页查询聊天记录
  listDictionaries, // 查询系统字典表
  listKnowledgeFiles, // 查询后端知识库文件列表
  previewKnowledgeDocument, // 预览已入库知识库文件
  reloadKnowledge, // 调用后端知识库重载接口
  recommendKnowledgeUpload, // 调用模型推荐上传文件切分方式
  reindexAllKnowledgeFiles, // 重新索引全部知识库文件
  reindexKnowledgeFile, // 重新索引后端知识库文件
  sendChat, // 调用一次性聊天接口
  sendChatStream, // 调用流式聊天接口
  setDictionaryItemEnabled, // 启用或禁用字典项
  updateDictionaryGroup, // 修改父级字典
  updateDictionaryItem, // 修改字典项
  previewKnowledgeFile, // 上传文件并获取文档类型预览
  type HealthResponse, // 健康检查响应类型
  type ConversationDetailResponse, // 聊天记录详情响应类型
  type ConversationSummaryResponse, // 聊天记录列表项响应类型
  type DictionaryGroupResponse, // 字典分组响应类型
  type DictionaryItemResponse, // 字典项响应类型
  type KnowledgeFileResponse, // 知识库文件响应类型
  type KnowledgeFilePreviewResponse, // 已入库文件预览响应类型
  type KnowledgeUploadPreviewResponse, // 上传预览响应类型
  type KnowledgeUploadRecommendResponse, // 模型推荐切分方式响应类型
  type ModelMode, // 回答模型档位类型
} from './api' // 前端 API 请求封装

interface ChatMessage { // 页面聊天消息的数据结构
  id: number // 消息唯一 ID，用于 v-for key
  role: 'user' | 'assistant' // 消息角色：用户或助手
  content: string // 消息正文
  pending?: boolean // 助手消息是否还在生成中
  firstTokenMs?: number | null // 助手首字/首片返回耗时
  totalMs?: number | null // 助手完整回答总耗时
}

type OutputMode = string // 输出模式，具体可选值来自 output_mode 字典
type ThemeMode = 'dark' | 'light' // 页面主题模式：深色科技风或浅色商务风

interface DictionaryFormState { // 字典项编辑表单
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

interface DictionaryGroupFormState { // 父级字典编辑表单
  dictionaryCode: string
  dictionaryName: string
}

const userPool = ['1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', '1009', '1010'] // 模拟用户 ID 池

function generateUserId(excludeUserId?: string) { // 生成一个用户 ID
  // 清空对话时需要生成一个新的 userId。
  // excludeUserId 用来避免随机结果仍然等于当前用户，保证“新会话”真的换了用户。
  const candidates = excludeUserId ? userPool.filter((id) => id !== excludeUserId) : userPool // 排除当前用户 ID
  const source = candidates.length > 0 ? candidates : userPool // 如果排除后还有候选，就用候选；否则兜底用完整池
  return source[Math.floor(Math.random() * source.length)] // 从候选池中随机取一个
}

function welcomeMessage(userId: string): ChatMessage { // 创建欢迎消息
  // 每次新会话都会放入一条助手欢迎消息，顺便把当前 userId 展示给用户。
  return { // 返回一条助手消息对象
    id: Date.now(), // 用当前时间戳作为消息 ID
    role: 'assistant', // 欢迎语由助手发出
    content: `你好，我是扫地/扫拖机器人智能客服。当前用户 ID：${userId}。可以问我选购、故障、保养和个人使用报告。`, // 欢迎语正文
  }
}

const input = ref('') // 输入框内容
const loading = ref(false) // 是否正在生成回答
const reloading = ref(false) // 是否正在重新加载知识库
const reindexingAll = ref(false) // 是否正在重新索引全部知识库文件
const knowledgeLoading = ref(false) // 是否正在刷新知识库文件列表
const uploadingKnowledge = ref(false) // 是否正在上传知识库文件
const confirmingKnowledge = ref(false) // 是否正在确认入库
const activeKnowledgeAction = ref('') // 当前正在执行的文件操作，用于控制单行按钮 loading
const knowledgeFiles = ref<KnowledgeFileResponse[]>([]) // 后端返回的知识库文件列表
const knowledgeKeyword = ref('') // 知识库文件名模糊查询关键词
const knowledgeFileInput = ref<HTMLInputElement | null>(null) // 隐藏的文件选择框，用于触发本地文件选择
const knowledgeDialogVisible = ref(false) // 知识库弹窗是否可见
const activeKnowledgeCollection = ref('') // 知识库管理弹窗当前选中的知识库 tab；为空时等待列表刷新后自动选中第一个
const knowledgePage = ref(1) // 知识库弹窗当前页码
const knowledgePageSize = 9 // 知识库弹窗每页 9 个文件
const uploadPreviewVisible = ref(false) // 上传预览弹窗是否可见
const uploadPreview = ref<KnowledgeUploadPreviewResponse | null>(null) // 当前上传文件的预解析结果
const uploadRecommendation = ref<KnowledgeUploadRecommendResponse | null>(null) // 当前上传文件的模型推荐结果
const recommendingKnowledge = ref(false) // 是否正在调用模型推荐切分方式
const knowledgePreviewVisible = ref(false) // 已入库文件预览弹窗是否可见
const knowledgePreviewLoading = ref(false) // 是否正在加载已入库文件预览内容
const knowledgePreview = ref<KnowledgeFilePreviewResponse | null>(null) // 当前正在预览的知识库文件内容
const selectedDocumentType = ref('') // 用户确认后的文档结构类型，默认值由 document_structure 字典提供
const selectedSplitStrategy = ref('') // 用户确认后的切分策略，默认值由 split_strategy 字典提供
const conversationDialogVisible = ref(false) // 聊天记录弹窗是否可见
const conversationLoading = ref(false) // 聊天记录列表是否加载中
const conversationDetailLoading = ref(false) // 聊天记录详情是否加载中
const conversationPage = ref(1) // 聊天记录当前页码
const conversationPageSize = 6 // 聊天记录每页 6 条，避免列表过密导致内容和操作按钮挤在一起
const conversationTotal = ref(0) // 聊天记录总数
const conversations = ref<ConversationSummaryResponse[]>([]) // 当前页聊天记录
const conversationKeyword = ref('') // 聊天记录名称模糊查询关键词
const selectedConversation = ref<ConversationDetailResponse | null>(null) // 当前选中的聊天记录详情
const activeConversationAction = ref('') // 当前正在执行的会话操作，用于控制单行按钮 loading
const dictionaryDialogVisible = ref(false) // 字典表弹窗是否可见
const dictionaryLoading = ref(false) // 是否正在加载字典表
const dictionaryGroups = ref<DictionaryGroupResponse[]>([]) // 后端返回的字典分组列表
const activeDictionaryCode = ref('') // 当前进入的父级字典编码；为空时展示父级字典列表
const dictionaryPage = ref(1) // 父级字典列表当前页码
const dictionaryPageSize = 8 // 父级字典列表每页展示数量
const dictionaryItemDialogVisible = ref(false) // 字典项新增/编辑弹窗是否可见
const dictionaryItemSaving = ref(false) // 字典项保存中
const dictionaryGroupDialogVisible = ref(false) // 父级字典新增/编辑弹窗是否可见
const dictionaryGroupSaving = ref(false) // 父级字典保存中
const activeDictionaryAction = ref('') // 当前字典项操作 key，用于控制单行 loading
const editingDictionaryItemId = ref('') // 当前正在编辑的字典项 ID；为空表示新增
const editingDictionaryGroupCode = ref('') // 当前正在编辑的父级字典编码；为空表示新增
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
const themeMode = ref<ThemeMode>(readInitialThemeMode()) // 当前页面主题，默认深色并支持本地持久化
const themeToggleIcon = computed(() => (themeMode.value === 'dark' ? Sun : Moon)) // 当前主题切换按钮图标

// outputMode 控制本次发送使用哪种接口：
// - stream：调用 `/chat/stream`，后端通过 SSE 一段段返回，页面实时追加。
// - once：调用 `/chat`，后端完整生成后返回 JSON，页面一次性展示。
const outputMode = ref<OutputMode>('') // 输出模式，默认值由 output_mode 字典提供
const modelMode = ref<ModelMode>('') // 回答模型档位，默认值由 model_mode 字典提供
const selectedCollectionName = ref('agent') // 当前聊天检索使用的 Qdrant collection
const selectedUploadCollection = ref('agent') // 当前上传文件将写入的 Qdrant collection

// userId 会随每次请求传给后端。
// 后端工具 get_user_id 会读取这个值，再用于查询用户外部数据或生成报告。
const userId = ref(generateUserId()) // 当前会话用户 ID
const conversationId = ref<string | null>(null) // 当前后端会话 ID；首轮为空，由后端创建
const health = ref<HealthResponse | null>(null) // 后端健康状态，初始为空

// messages 是页面聊天记录。
// 注意：流式输出时必须通过 messages.value[index] 更新消息，
// 这样 Vue 才能追踪到 content 的变化并立即重新渲染。
const messages = ref<ChatMessage[]>([welcomeMessage(userId.value)]) // 页面消息列表，初始放一条欢迎消息
const messageList = ref<HTMLElement | null>(null) // 消息列表 DOM 引用，用于滚动到底部

// abortController 保存当前请求的取消控制器。
// 用户点击“停止”时，会调用 abortController.abort() 中断 fetch。
const abortController = ref<AbortController | null>(null) // 当前请求的取消控制器

function readInitialThemeMode(): ThemeMode { // 读取本地保存的主题，没有保存时使用深色
  if (typeof window === 'undefined') return 'dark' // 构建阶段没有 window，兜底深色
  const savedTheme = window.localStorage.getItem('ai-rag-agent-theme') // 读取上次用户选择
  return savedTheme === 'light' ? 'light' : 'dark' // 只接受明确的 light，其余都按 dark 处理
}

watch(themeMode, (nextTheme) => { // 用户切换主题后保存到浏览器
  window.localStorage.setItem('ai-rag-agent-theme', nextTheme) // 下次打开页面继续沿用当前主题
})

watch(knowledgeKeyword, () => { // 知识库名称搜索变化时回到第一页
  knowledgePage.value = 1
})

watch(activeKnowledgeCollection, () => { // 切换知识库 tab 时回到第一页
  knowledgePage.value = 1
})

watch(conversationKeyword, () => { // 聊天记录名称搜索变化时重新查询第一页
  conversationPage.value = 1
  selectedConversation.value = null
  if (conversationDialogVisible.value) {
    void refreshConversations()
  }
})

watch(dictionaryGroups, () => { // 字典刷新后，如果当前详情不存在了就回到父级列表
  if (activeDictionaryCode.value && !dictionaryGroups.value.some((group) => group.dictionary_code === activeDictionaryCode.value)) {
    activeDictionaryCode.value = ''
  }
  const maxPage = Math.max(1, Math.ceil(dictionaryGroups.value.length / dictionaryPageSize))
  dictionaryPage.value = Math.min(dictionaryPage.value, maxPage)
})

const knowledgeFilesInActiveCollection = computed(() => { // 先按当前知识库 tab 过滤文件
  if (!activeKnowledgeCollection.value) return knowledgeFiles.value
  return knowledgeFiles.value.filter((file) => file.collection_name === activeKnowledgeCollection.value)
})

const filteredKnowledgeFiles = computed(() => { // 在当前知识库 tab 内按文件名模糊过滤文件
  const keyword = knowledgeKeyword.value.trim().toLowerCase()
  if (!keyword) return knowledgeFilesInActiveCollection.value
  return knowledgeFilesInActiveCollection.value.filter((file) => file.filename.toLowerCase().includes(keyword))
})

const pagedKnowledgeFiles = computed(() => { // 当前知识库页展示的 9 个文件
  const start = (knowledgePage.value - 1) * knowledgePageSize // 计算当前页起始下标
  return filteredKnowledgeFiles.value.slice(start, start + knowledgePageSize) // 返回当前页文件
})

const indexedKnowledgeCount = computed(() => knowledgeFiles.value.filter((file) => file.status === 'indexed').length) // 全部知识库已索引文件数
const activeIndexedKnowledgeCount = computed(() => ( // 当前知识库 tab 内已索引文件数
  knowledgeFilesInActiveCollection.value.filter((file) => file.status === 'indexed').length
))
const collectionOptions = computed(() => { // 汇总健康检查和文件列表中的 collection，供下拉选择
  const names = new Set<string>([health.value?.collection_name || 'agent'])
  for (const collectionName of health.value?.collections || []) {
    if (collectionName) names.add(collectionName)
  }
  for (const file of knowledgeFiles.value) {
    if (file.collection_name) names.add(file.collection_name)
  }
  return Array.from(names).sort((left, right) => left.localeCompare(right))
})

const knowledgeCollectionTabs = computed(() => ( // 知识库管理弹窗的 collection tab，附带每个知识库的文件统计
  collectionOptions.value.map((collectionName) => {
    const files = knowledgeFiles.value.filter((file) => file.collection_name === collectionName)
    return {
      collectionName,
      total: files.length,
      indexed: files.filter((file) => file.status === 'indexed').length,
    }
  })
))

watch(collectionOptions, (collections) => { // 刷新列表后保证弹窗始终选中一个存在的知识库 tab
  if (!collections.length) {
    activeKnowledgeCollection.value = ''
    return
  }
  if (!activeKnowledgeCollection.value || !collections.includes(activeKnowledgeCollection.value)) {
    activeKnowledgeCollection.value = collections[0]
  }
}, { immediate: true })

function flattenDictionaryItems(items: DictionaryItemResponse[]): DictionaryItemResponse[] { // 把多层级字典项拉平成列表，便于下拉控件使用
  return items.flatMap((item) => [item, ...flattenDictionaryItems(item.children || [])])
}

function dictionaryItems(dictionaryCode: string) { // 按字典编码读取启用字典项
  const group = dictionaryGroups.value.find((item) => item.dictionary_code === dictionaryCode)
  return flattenDictionaryItems(group?.items || []).filter((item) => item.enabled)
}

function dictionaryDefaultCode(dictionaryCode: string) { // 取某组字典的默认编码，默认使用排序最靠前的启用项
  return dictionaryItems(dictionaryCode)[0]?.item_code || ''
}

function dictionaryCodeByMetadata(dictionaryCode: string, key: string, value: unknown) { // 按字典 metadata 读取具有特定业务含义的字典项编码
  return dictionaryItems(dictionaryCode).find((item) => item.metadata?.[key] === value)?.item_code || ''
}

const pagedDictionaryGroups = computed(() => { // 父级字典分页列表
  const start = (dictionaryPage.value - 1) * dictionaryPageSize
  return dictionaryGroups.value.slice(start, start + dictionaryPageSize)
})

const activeDictionaryGroup = computed(() => ( // 当前进入详情的父级字典
  dictionaryGroups.value.find((group) => group.dictionary_code === activeDictionaryCode.value) || null
))

function dictionaryGroupItemCount(group: DictionaryGroupResponse) { // 统计当前父级字典下所有层级的字典项数量
  return flattenDictionaryItems(group.items).length
}

function openDictionaryGroup(group: DictionaryGroupResponse) { // 进入某个父级字典的子级列表
  activeDictionaryCode.value = group.dictionary_code
}

function backToDictionaryGroups() { // 返回父级字典列表
  activeDictionaryCode.value = ''
}

function handleDictionaryPageChange(page: number) { // 父级字典分页
  dictionaryPage.value = page
}

async function confirmDangerOnce(
  message: string,
  title: string,
  confirmButtonText = '确认删除',
) { // 删除或清空类操作必须弹窗确认一次，避免误操作造成不可恢复的数据变化
  try {
    await ElMessageBox.confirm(
      message,
      title,
      {
        confirmButtonText,
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
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

function dictionaryActionKey(action: string, dictionaryItemId: string) { // 拼接字典项操作唯一 key
  return `${action}:${dictionaryItemId}`
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

function openEditDictionaryItemDialog(item: DictionaryItemResponse) { // 打开编辑字典项弹窗
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

function parseDictionaryMetadata() { // 解析表单中的 metadata JSON
  const rawText = dictionaryForm.value.metadataText.trim()
  if (!rawText) return {}
  const parsed = JSON.parse(rawText)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('扩展元数据必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

async function saveDictionaryItem() { // 保存新增或修改的字典项
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

function isOutputModeKind(kind: string) { // 判断当前输出模式是否属于某种字典配置的模式类型
  return outputMode.value === dictionaryCodeByMetadata('output_mode', 'mode_kind', kind)
}

function isKnowledgeResultStatus(status: string, metadataKey: string, metadataValue: unknown) { // 按字典 metadata 判断知识库操作结果
  const targetCode = dictionaryCodeByMetadata('knowledge_result_status', metadataKey, metadataValue)
  return Boolean(targetCode) && status === targetCode
}

async function scrollToBottom() { // 滚动聊天列表到底部
  // nextTick 等待 Vue 把刚刚追加的消息或 chunk 渲染到 DOM。
  // 如果不等 DOM 更新就滚动，scrollHeight 可能还是旧值。
  await nextTick() // 等待 Vue 完成 DOM 更新
  if (messageList.value) { // DOM 已挂载时才可以操作滚动条
    messageList.value.scrollTop = messageList.value.scrollHeight // 滚动到最底部
  }
}

async function refreshHealth() { // 刷新后端健康状态
  try {
    health.value = await fetchHealth() // 请求 /health 并保存结果
    if (!selectedCollectionName.value) {
      selectedCollectionName.value = health.value.collection_name || 'agent'
    }
  } catch {
    health.value = { // 健康检查失败时，给页面一个降级状态
      status: 'degraded', // 整体服务降级
      qdrant: 'unavailable', // Qdrant 不可用
      collection_name: 'agent', // 默认 collection 名称
      collections: [], // collection 列表为空
    }
    if (!selectedCollectionName.value) {
      selectedCollectionName.value = 'agent'
    }
  }
}

async function refreshDictionaries() { // 刷新系统字典表
  dictionaryLoading.value = true // 打开字典加载状态
  try {
    dictionaryGroups.value = await listDictionaries() // 从后端读取全部字典分组
    selectedDocumentType.value ||= dictionaryDefaultCode('document_structure') // 上传文档结构默认取字典第一项
    selectedSplitStrategy.value ||= dictionaryDefaultCode('split_strategy') // 上传切分策略默认取字典第一项
    outputMode.value ||= dictionaryDefaultCode('output_mode') // 输出模式默认取字典第一项
    modelMode.value ||= dictionaryDefaultCode('model_mode') // 模型档位默认取字典第一项
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典表加载失败') // 展示字典加载错误
  } finally {
    dictionaryLoading.value = false // 关闭字典加载状态
  }
}

async function openDictionaryDialog() { // 打开字典表页面
  dictionaryDialogVisible.value = true // 先打开弹窗，让用户看到加载状态
  await refreshDictionaries() // 每次打开时刷新，避免展示旧配置
}

function knowledgeStatusType(status: string) { // 把后端状态映射成 Element Plus tag 样式
  const item = dictionaryItems('document_status').find((option) => option.item_code === status)
  return String(item?.metadata?.tag_type || 'info') // 颜色配置来自字典 metadata
}

function formatFileSize(size: number) { // 把字节数格式化成更易读的大小
  if (size < 1024) return `${size} B` // 小于 1KB 直接显示字节
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB` // 小于 1MB 显示 KB
  return `${(size / 1024 / 1024).toFixed(1)} MB` // 其它显示 MB
}

function formatDateTime(value: string) { // 格式化后端返回的 ISO 时间字符串
  return value.replace('T', ' ').slice(0, 19) // 保留到秒，避免列表太长
}

function formatDuration(value?: number | null) { // 把毫秒耗时格式化成页面展示文本
  if (value === null || value === undefined) return '--'
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(2)}s`
}

function serviceStatusLabel(status?: string) { // 把服务状态转换成页面中文文案
  if (!status) return '检测中'
  return dictionaryItems('service_status').find((item) => item.item_code === status)?.item_name || status
}

function knowledgeActionKey(action: string, documentId: string) { // 拼接文件操作唯一 key
  return `${action}:${documentId}` // 用于判断当前行哪个按钮正在 loading
}

function conversationActionKey(action: string, conversationIdValue: string) { // 拼接会话操作唯一 key
  return `${action}:${conversationIdValue}` // 用于判断当前行哪个按钮正在 loading
}

async function refreshKnowledgeFiles() { // 刷新知识库文件列表
  knowledgeLoading.value = true // 打开列表 loading
  try {
    knowledgeFiles.value = await listKnowledgeFiles() // 调用后端文件列表接口
    const maxPage = Math.max(1, Math.ceil(filteredKnowledgeFiles.value.length / knowledgePageSize)) // 计算最大页码
    knowledgePage.value = Math.min(knowledgePage.value, maxPage) // 删除文件后避免停留在空页
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识库文件列表加载失败') // 展示错误
  } finally {
    knowledgeLoading.value = false // 关闭列表 loading
  }
}

async function openKnowledgeDialog() { // 打开知识库弹窗
  knowledgeDialogVisible.value = true // 展示弹窗
  await refreshKnowledgeFiles() // 打开时刷新最新文件列表
}

async function openConversationDialog() { // 打开聊天记录弹窗
  conversationDialogVisible.value = true // 展示弹窗
  selectedConversation.value = null // 默认先展示列表，不选中详情
  conversationPage.value = 1 // 每次打开从第一页开始
  await refreshConversations() // 加载第一页聊天记录
}

async function refreshConversations() { // 刷新聊天记录列表
  conversationLoading.value = true // 打开列表 loading
  try {
    const response = await listConversations(
      conversationPage.value,
      conversationPageSize,
      undefined,
      conversationKeyword.value,
    ) // 请求聊天记录分页接口
    conversations.value = response.items // 保存当前页数据
    conversationTotal.value = response.total // 保存总数
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '聊天记录加载失败') // 展示错误
  } finally {
    conversationLoading.value = false // 关闭列表 loading
  }
}

async function handleConversationPageChange(page: number) { // 聊天记录翻页
  conversationPage.value = page // 更新页码
  selectedConversation.value = null // 翻页后清空右侧详情
  await refreshConversations() // 重新加载列表
}

async function handleKnowledgePageChange(page: number) { // 知识库文件翻页
  knowledgePage.value = page // 更新知识库页码
}

async function openConversationDetail(conversation: ConversationSummaryResponse) { // 查看聊天记录详情
  conversationDetailLoading.value = true // 打开详情 loading
  try {
    selectedConversation.value = await getConversationDetail(conversation.conversation_id) // 查询详情
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '聊天详情加载失败') // 展示错误
  } finally {
    conversationDetailLoading.value = false // 关闭详情 loading
  }
}

async function handleDeleteConversation(conversation: ConversationSummaryResponse) { // 删除单个聊天记录
  const conversationTitle = conversation.title || '未命名会话'
  const confirmed = await confirmDangerOnce(
    `确定删除「${conversationTitle}」吗？删除后该会话的消息明细也会清空。`,
    '删除聊天记录',
    '删除',
  )
  if (!confirmed) return // 用户取消确认时退出

  const actionKey = conversationActionKey('delete', conversation.conversation_id) // 当前行删除按钮 loading key
  activeConversationAction.value = actionKey // 标记当前会话正在删除

  try {
    await deleteConversation(conversation.conversation_id) // 调用后端删除接口
    ElMessage.success('聊天记录已删除') // 成功提示

    if (selectedConversation.value?.conversation.conversation_id === conversation.conversation_id) {
      selectedConversation.value = null // 如果当前详情就是被删除会话，清空右侧详情
    }

    if (conversationId.value === conversation.conversation_id) {
      conversationId.value = null // 当前聊天区会话被删后，下一次发送让后端创建新会话
      messages.value = [welcomeMessage(userId.value)] // 页面也回到新会话欢迎状态
      input.value = '' // 清空输入，避免继续沿用旧上下文
      await scrollToBottom() // 刷新聊天区滚动位置
    }

    const maxPageAfterDelete = Math.max(1, Math.ceil((conversationTotal.value - 1) / conversationPageSize))
    conversationPage.value = Math.min(conversationPage.value, maxPageAfterDelete) // 删除最后一页最后一条时回到有效页
    await refreshConversations() // 刷新列表和总数
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '聊天记录删除失败') // 展示错误
  } finally {
    activeConversationAction.value = '' // 清空当前操作状态
  }
}

async function continueConversation() { // 从聊天记录继续当前会话
  if (!selectedConversation.value) return // 没有选中会话时直接退出
  if (loading.value) {
    stopGenerating() // 如果主聊天区正在生成，先停止，避免两个会话流互相写入
  }

  const detail = selectedConversation.value // 当前已加载的会话详情
  const nextUserId = detail.conversation.user_id || userId.value // 优先沿用历史会话自己的 user_id
  userId.value = nextUserId // 设置当前用户 ID
  conversationId.value = detail.conversation.conversation_id // 设置当前 conversation_id，后续发送继续这个会话
  messages.value = detail.messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: message.sequence_no,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      pending: false,
      firstTokenMs: message.role === 'assistant' ? message.first_token_ms : undefined,
      totalMs: message.role === 'assistant' ? message.total_ms : undefined,
    })) // 把数据库消息转换成主聊天区消息

  if (messages.value.length === 0) {
    messages.value = [welcomeMessage(userId.value)] // 极端情况下没有消息，兜底展示欢迎语
  }

  conversationDialogVisible.value = false // 关闭聊天记录弹窗
  ElMessage.success('已切换到该历史会话，可以继续聊天') // 给用户明确反馈
  await scrollToBottom() // 滚动到历史会话最新位置
}

function openKnowledgeFilePicker() { // 打开本地文件选择框
  knowledgeFileInput.value?.click() // 触发隐藏 input 的 click
}

async function handleKnowledgeFileChange(event: Event) { // 用户选择文件后上传
  const target = event.target as HTMLInputElement // 取到原生 input 元素
  const file = target.files?.[0] // 当前只允许一次上传一个文件

  if (!file) return // 用户取消选择时直接退出

  uploadingKnowledge.value = true // 打开上传按钮 loading
  try {
    const response = await previewKnowledgeFile(file) // 先上传到临时区并获取识别结果
    if (response.duplicate) { // 后端判断 MD5 已存在
      ElMessage.info('当前已有相同内容文件，也可以选择新 Collection 后继续入库') // 展示重复提示
    }
    uploadPreview.value = response // 保存预览结果
    uploadRecommendation.value = null // 新文件上传时清空上一次模型推荐
    selectedDocumentType.value = response.detected_type // 默认采用系统识别类型
    selectedSplitStrategy.value = response.split_strategy // 默认采用系统识别切分策略
    selectedUploadCollection.value = selectedCollectionName.value || health.value?.collection_name || 'agent' // 默认写入当前聊天 collection
    uploadPreviewVisible.value = true // 打开用户确认弹窗
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件预解析失败') // 展示错误
  } finally {
    uploadingKnowledge.value = false // 关闭上传按钮 loading
    target.value = '' // 清空 input 值，允许再次选择同一个文件
  }
}

async function handleRecommendKnowledgeUpload() { // 调用模型推荐当前上传文件的切分方式
  if (!uploadPreview.value || recommendingKnowledge.value) return // 没有预览文件或正在推荐时直接退出

  recommendingKnowledge.value = true // 打开模型推荐 loading
  try {
    const recommendation = await recommendKnowledgeUpload(uploadPreview.value.upload_id) // 调用后端模型推荐接口
    uploadRecommendation.value = recommendation // 保存推荐结果用于页面展示
    selectedDocumentType.value = recommendation.document_type // 自动采用模型推荐文档类型
    selectedSplitStrategy.value = recommendation.split_strategy // 自动采用模型推荐切分策略
    ElMessage.success('已采用模型推荐的切分方式') // 提示用户推荐已应用
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '模型推荐失败') // 展示错误
  } finally {
    recommendingKnowledge.value = false // 关闭模型推荐 loading
  }
}

async function handleConfirmKnowledgeUpload() { // 用户确认预览后正式入库
  if (!uploadPreview.value || confirmingKnowledge.value) return // 没有预览数据或正在入库时直接退出

  confirmingKnowledge.value = true // 打开确认入库 loading
  try {
    const response = await confirmKnowledgeUpload(
      uploadPreview.value.upload_id,
      selectedDocumentType.value,
      selectedSplitStrategy.value,
      selectedUploadCollection.value,
    ) // 调用后端确认入库接口
    if (isKnowledgeResultStatus(response.status, 'result_kind', 'duplicate')) { // 确认阶段再次发现重复
      ElMessage.info(response.message || '相同内容的文件已经存在') // 展示重复提示
    } else {
      ElMessage.success(response.message || '文件已写入知识库') // 展示成功提示
    }
    uploadPreviewVisible.value = false // 关闭弹窗
    uploadPreview.value = null // 清空预览状态
    uploadRecommendation.value = null // 清空模型推荐状态
    await refreshKnowledgeFiles() // 刷新文件列表
    await refreshHealth() // 刷新 Qdrant 状态
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件入库失败') // 展示错误
  } finally {
    confirmingKnowledge.value = false // 关闭 loading
  }
}

function previewTypeLabel(previewType: string) { // 把后端 preview_type 转成页面展示文本
  return dictionaryItems('preview_type').find((item) => item.item_code === previewType)?.item_name || previewType
}

function messageRoleLabel(role: string) { // 把消息角色编码转成页面展示文本
  return dictionaryItems('message_role').find((item) => item.item_code === role)?.item_name || role
}

async function handlePreviewKnowledgeFile(file: KnowledgeFileResponse) { // 预览已入库知识库文件
  const actionKey = knowledgeActionKey('preview', file.document_id) // 当前行预览按钮的 loading key
  knowledgePreviewVisible.value = true // 先打开弹窗，让用户看到加载状态
  knowledgePreviewLoading.value = true // 打开预览 loading
  knowledgePreview.value = null // 清空上一次预览结果，避免短暂显示旧内容
  activeKnowledgeAction.value = actionKey // 标记当前行正在预览

  try {
    knowledgePreview.value = await previewKnowledgeDocument(file.document_id) // 调用后端文件预览接口
  } catch (error) {
    knowledgePreviewVisible.value = false // 加载失败时关闭空弹窗
    ElMessage.error(error instanceof Error ? error.message : '文件预览失败') // 展示后端错误
  } finally {
    knowledgePreviewLoading.value = false // 关闭预览 loading
    if (activeKnowledgeAction.value === actionKey) {
      activeKnowledgeAction.value = '' // 只清理本次预览设置的 loading 状态
    }
  }
}

async function handleReindexKnowledgeFile(file: KnowledgeFileResponse) { // 重新索引单个知识库文件
  try {
    await ElMessageBox.confirm( // 重建索引会调用 embedding 和 Qdrant，先让用户确认
      `确定重新索引「${file.filename}」吗？`,
      '重新索引',
      {
        confirmButtonText: '重新索引',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return // 用户取消确认时退出
  }

  activeKnowledgeAction.value = knowledgeActionKey('reindex', file.document_id) // 标记当前行重建中
  try {
    await reindexKnowledgeFile(file.document_id) // 调用后端重建索引接口
    ElMessage.success('已重新索引') // 成功提示
    await refreshKnowledgeFiles() // 刷新列表中的 version/chunk_count/status
    await refreshHealth() // 刷新健康状态
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新索引失败') // 展示错误
  } finally {
    activeKnowledgeAction.value = '' // 清空当前操作状态
  }
}

async function handleReindexAllKnowledgeFiles() { // 清空 Qdrant collection 并重新索引全部知识库文件
  const confirmed = await confirmDangerOnce(
    '确定清空旧向量并重新索引全部知识库文件吗？这个操作会重新生成向量，文件多时会比较慢。',
    '清空并重建',
    '清空并重建',
  )
  if (!confirmed) return // 用户取消确认时退出

  reindexingAll.value = true // 打开批量重建 loading
  try {
    const response = await reindexAllKnowledgeFiles() // 调用后端清空 collection 并批量重建接口
    if (response.failed > 0) { // 有部分文件失败
      ElMessage.warning(`重建完成：成功 ${response.succeeded} 个，失败 ${response.failed} 个`) // 展示部分失败
    } else {
      ElMessage.success(`全部重建完成：${response.succeeded} 个文件`) // 展示成功
    }
    await refreshKnowledgeFiles() // 刷新列表中的 chunk_count/version/status
    await refreshHealth() // 刷新健康状态
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清空并重建失败') // 展示错误
  } finally {
    reindexingAll.value = false // 关闭 loading
  }
}

async function handleDeleteKnowledgeFile(file: KnowledgeFileResponse) { // 删除单个知识库文件
  const confirmed = await confirmDangerOnce(
    `确定删除「${file.filename}」吗？`,
    '删除知识库文件',
    '删除',
  )
  if (!confirmed) return // 用户取消确认时退出

  activeKnowledgeAction.value = knowledgeActionKey('delete', file.document_id) // 标记当前行删除中
  try {
    await deleteKnowledgeFile(file.document_id) // 调用后端删除接口
    ElMessage.success('已删除知识库文件') // 成功提示
    await refreshKnowledgeFiles() // 删除后刷新列表
    await refreshHealth() // 删除后刷新健康状态
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败') // 展示错误
  } finally {
    activeKnowledgeAction.value = '' // 清空当前操作状态
  }
}

async function handleReloadKnowledge() { // 点击“重新加载知识库”时执行
  // 重新加载知识库会触发后端扫描 data 目录并写入 Qdrant。
  // 这个操作和聊天输出模式无关，只影响后续 RAG 检索到的资料。
  reloading.value = true // 打开按钮 loading
  try {
    await reloadKnowledge() // 调用后端知识库重载接口
    ElMessage.success('知识库已重新加载') // 成功提示
    await refreshKnowledgeFiles() // 尝试同步刷新文件管理列表
    await refreshHealth() // 重载后刷新状态
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识库加载失败') // 失败时展示错误
  } finally {
    reloading.value = false // 无论成功失败，都关闭按钮 loading
  }
}

function resetAbortController() { // 为新请求创建取消控制器
  // 每次发送前创建一个新的 AbortController。
  // 同一个 controller 不能复用；一旦 abort 后，它会永久处于 aborted 状态。
  abortController.value = new AbortController() // 创建新的 AbortController
  return abortController.value // 返回给本次请求使用
}

function stopGenerating() { // 停止当前生成
  // 停止生成只负责中断前端 fetch。
  // 后端和模型是否能立即停止，取决于底层连接关闭和模型 SDK 的处理速度。
  abortController.value?.abort() // 中断 fetch 请求
  loading.value = false // 关闭生成状态
  abortController.value = null // 清空当前取消控制器
}

async function clearConversation() { // 清空当前对话
  const confirmed = await confirmDangerOnce(
    '确定清空当前页面对话吗？页面消息会被重置，并切换新的用户 ID。',
    '清空当前对话',
    '清空对话',
  )
  if (!confirmed) return

  // 清空对话时如果正在生成，先中断当前请求，避免旧请求继续写入已经清空的消息列表。
  if (loading.value) { // 如果正在生成
    stopGenerating() // 先停止生成，避免旧流继续写入
  }

  userId.value = generateUserId(userId.value) // 换一个新的用户 ID
  conversationId.value = null // 清空后让后端创建新 conversation_id
  messages.value = [welcomeMessage(userId.value)] // 重置消息列表，只保留欢迎语
  input.value = '' // 清空输入框
  ElMessage.success(`已清空对话，新用户 ID：${userId.value}`) // 显示成功提示
  void scrollToBottom() // 滚动到底部；void 表示不用等待这个 Promise
}

async function handleSend() { // 发送消息主函数
  // 统一的发送入口。
  // 用户点击“发送”、按 Enter，或点击快捷问题，最终都会进入这里。
  const question = input.value.trim() // 去掉输入内容首尾空格
  if (!question || loading.value) return // 空问题或正在生成时，不允许再次发送

  // 先清空输入框并进入 loading 状态，防止用户重复提交同一个问题。
  input.value = '' // 清空输入框
  loading.value = true // 进入生成中状态

  // 先把用户问题追加到聊天记录。
  messages.value.push({ // 追加用户消息
    id: Date.now(), // 消息 ID
    role: 'user', // 用户角色
    content: question, // 用户问题正文
  })

  // 再追加一条空的助手消息，用于承接后端返回内容。
  //
  // 这里保存的是 assistantMessageIndex，而不是保存对象引用。
  // 原因：如果保存原始对象再直接修改 `assistantMessage.content`，
  // Vue 可能无法逐 chunk 追踪到变化，页面就会等到最后才刷新。
  // 通过 `messages.value[assistantMessageIndex]` 修改数组里的响应式对象，
  // 每个 chunk 到达时都能触发页面更新。
  const assistantMessageIndex = messages.value.push({ // 追加助手占位消息，并记录它在数组中的位置
    id: Date.now() + 1, // 助手消息 ID，简单错开用户消息时间戳
    role: 'assistant', // 助手角色
    content: '', // 初始内容为空，等待后端填充
    pending: true, // 显示生成中图标
  }) - 1 // push 返回新长度，减 1 得到新消息下标
  await scrollToBottom() // 新消息出现后滚动到底部

  // controller.signal 会传给 fetch。
  // 后面“停止生成”按钮可以通过同一个 controller 中断这次请求。
  const controller = resetAbortController() // 创建本次请求的取消控制器

  try {
    if (isOutputModeKind('stream')) { // 当前选择“流式输出”
      // 流式输出路径：
      // - sendChatStream 内部会读取后端 SSE。
      // - 每解析到一个 {"content": "..."} 事件，就调用这里的回调。
      // - 回调只做两件事：追加文本、等待页面滚动到底部。
      await sendChatStream( // 调用流式接口
        question, // 用户问题
        userId.value, // 当前用户 ID
        conversationId.value, // 当前会话 ID，首轮为空
        modelMode.value, // 当前回答模型档位
        selectedCollectionName.value, // 当前检索的 Qdrant collection
        async (chunk) => { // 每收到一个 chunk，就执行这个回调
          messages.value[assistantMessageIndex].content += chunk // 把 chunk 追加到助手消息正文
          await scrollToBottom() // DOM 更新后滚动到底部
        },
        (nextConversationId) => { // 后端在 meta/done 事件里返回会话 ID
          conversationId.value = nextConversationId // 保存后续请求使用
        },
        (metrics) => { // 后端 metric/done 事件返回耗时
          if (metrics.first_token_ms !== undefined && metrics.first_token_ms !== null) {
            messages.value[assistantMessageIndex].firstTokenMs = metrics.first_token_ms // 更新首字耗时
          }
          if (metrics.total_ms !== undefined && metrics.total_ms !== null) {
            messages.value[assistantMessageIndex].totalMs = metrics.total_ms // 更新总耗时
          }
        },
        controller.signal, // 传入取消信号，支持停止生成
      )
    } else {
      // 一次性输出路径：
      // - sendChat 会等待 `/chat` 返回完整 JSON。
      // - response.answer 已经是最终完整回答。
      // - 页面只赋值一次，因此不会出现逐字/逐段渲染。
      const response = await sendChat(
        question,
        userId.value,
        conversationId.value,
        modelMode.value,
        selectedCollectionName.value,
        controller.signal,
      ) // 调用一次性接口并等待完整回答
      conversationId.value = response.conversation_id || conversationId.value // 保存后续请求使用
      messages.value[assistantMessageIndex].content = response.answer || '没有返回内容' // 一次性填充助手消息
      messages.value[assistantMessageIndex].firstTokenMs = response.first_token_ms ?? response.total_ms ?? null // 一次性没有真实首字，显示完整耗时
      messages.value[assistantMessageIndex].totalMs = response.total_ms ?? null // 更新总耗时
    }
  } catch (error) {
    if (controller.signal.aborted) { // 如果是用户主动停止导致的异常
      // 用户主动停止时，不把它当成系统错误。
      // 如果停止前已经收到部分内容，就保留已有内容；否则显示“已停止生成”。
      messages.value[assistantMessageIndex].content = messages.value[assistantMessageIndex].content || '已停止生成' // 没有内容时显示停止提示
    } else {
      // 网络错误、后端错误、SSE error 事件都会进入这里，直接展示错误信息。
      messages.value[assistantMessageIndex].content = error instanceof Error ? error.message : '请求失败' // 展示异常信息
    }
  } finally {
    // 无论成功、失败还是被中断，都要退出 loading 状态并隐藏 pending 图标。
    messages.value[assistantMessageIndex].pending = false // 隐藏助手消息里的加载图标
    loading.value = false // 退出全局生成状态
    abortController.value = null // 清空取消控制器
    await scrollToBottom() // 最后再滚动一次，确保完整内容可见
  }
}

function askPreset(question: string) { // 点击快捷问题时执行
  // 快捷问题复用同一套发送逻辑，避免维护第二条请求路径。
  input.value = question // 把快捷问题填入输入框
  void handleSend() // 复用发送逻辑；void 表示不等待 Promise
}

onMounted(() => { // Vue 组件挂载完成后执行
  // 页面打开后立即检查后端和 Qdrant 状态，用于左侧状态栏展示。
  void refreshHealth() // 页面打开后主动刷新一次服务状态
  void refreshKnowledgeFiles() // 页面打开后同步加载知识库文件列表
  void refreshDictionaries() // 页面打开后加载字典表，供下拉和字典页复用
})
</script>

<template>
  <main class="app-shell" :class="`theme-${themeMode}`">
    <aside class="side-panel">
      <div class="brand">
        <div class="brand-mark">
          <Bot :size="24" />
        </div>
        <div>
          <h1>AI RAG Agent</h1>
          <p>扫地机器人智能客服</p>
        </div>
      </div>

      <section class="status-block">
        <div class="section-title">
          <ShieldCheck :size="18" />
          <span>服务状态</span>
          <el-button class="status-refresh-button" :icon="RefreshCw" circle size="small" @click="refreshHealth" />
        </div>
        <div class="status-grid">
          <div class="status-row">
            <span>API</span>
            <span class="status-pill" :class="health?.status === 'ok' ? 'is-ok' : 'is-warning'">
              <CircleCheck v-if="health?.status === 'ok'" :size="14" />
              <LoaderCircle v-else-if="!health?.status" class="spin" :size="14" />
              <CircleAlert v-else :size="14" />
              {{ serviceStatusLabel(health?.status) }}
            </span>
          </div>
          <div class="status-row">
            <span>Qdrant</span>
            <span class="status-pill" :class="health?.qdrant === 'ok' ? 'is-ok' : 'is-danger'">
              <CircleCheck v-if="health?.qdrant === 'ok'" :size="14" />
              <LoaderCircle v-else-if="!health?.qdrant" class="spin" :size="14" />
              <CircleAlert v-else :size="14" />
              {{ serviceStatusLabel(health?.qdrant) }}
            </span>
          </div>
          <div class="status-row">
            <span>Collection</span>
            <span class="status-chip">{{ selectedCollectionName || health?.collection_name || 'agent' }}</span>
          </div>
          <div class="status-row">
            <span>用户 ID</span>
            <span class="status-chip">{{ userId }}</span>
          </div>
          <div class="status-row">
            <span>会话 ID</span>
            <span class="status-chip">{{ conversationId || 'new' }}</span>
          </div>
        </div>
      </section>

      <section class="status-block">
        <div class="section-title">
          <DatabaseZap :size="18" />
          <span>工作台</span>
        </div>
        <input
          ref="knowledgeFileInput"
          class="hidden-file-input"
          type="file"
          accept=".txt,.pdf"
          @change="handleKnowledgeFileChange"
        >
        <div class="workspace-actions">
          <button class="workspace-card" type="button" @click="openKnowledgeDialog">
            <span class="workspace-icon"><FolderOpen :size="20" /></span>
            <span>
              <strong>知识库管理</strong>
              <em>{{ indexedKnowledgeCount }}/{{ knowledgeFiles.length }} 已索引</em>
            </span>
          </button>
          <button class="workspace-card" type="button" @click="openConversationDialog">
            <span class="workspace-icon"><Clock3 :size="20" /></span>
            <span>
              <strong>聊天记录</strong>
              <em>分页查看历史会话</em>
            </span>
          </button>
          <button class="workspace-card" type="button" @click="openDictionaryDialog">
            <span class="workspace-icon"><FileText :size="20" /></span>
            <span>
              <strong>字典表</strong>
              <em>{{ dictionaryGroups.length }} 组系统字典</em>
            </span>
          </button>
        </div>
        <div class="knowledge-toolbar compact">
          <el-button
            class="full-button"
            :icon="Upload"
            :loading="uploadingKnowledge"
            type="primary"
            @click="openKnowledgeFilePicker"
          >
            上传文件
          </el-button>
          <el-button
            class="full-button"
            :icon="DatabaseZap"
            :loading="reloading"
            plain
            type="primary"
            color="#0b253f"
            @click="handleReloadKnowledge"
          >
            扫描 data
          </el-button>
        </div>
      </section>

      <section class="status-block">
        <div class="section-title">
          <Wifi :size="18" />
          <span>接口地址</span>
        </div>
        <code class="endpoint">{{ API_BASE_URL }}</code>
      </section>

    </aside>

    <section class="chat-panel">
      <header class="chat-header">
        <div>
          <h2>智能客服</h2>
          <p>Direct RAG · 智能检索中枢</p>
        </div>
        <div class="quick-actions">
          <el-button
            class="theme-toggle-button"
            :icon="themeToggleIcon"
            size="small"
            @click="themeMode = themeMode === 'dark' ? 'light' : 'dark'"
          >
            {{ themeMode === 'dark' ? '浅色' : '深色' }}
          </el-button>
          <el-button
            class="quick-action-button"
            :icon="ShieldCheck"
            size="small"
            @click="askPreset('小户型适合哪些扫地机器人？')"
          >
            小户型适配
          </el-button>
          <el-button
            class="quick-action-button"
            :icon="Search"
            size="small"
            @click="askPreset('扫地机器人迷路怎么办？')"
          >
            故障排查
          </el-button>
          <el-button
            class="quick-action-button"
            :icon="Clock3"
            size="small"
            @click="askPreset('给我生成我的使用报告')"
          >
            使用报告
          </el-button>
        </div>
      </header>

      <div ref="messageList" class="message-list">
        <article
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="message.role"
        >
          <div class="avatar">
            <Bot v-if="message.role === 'assistant'" :size="18" />
            <span v-else>我</span>
          </div>
          <div class="bubble">
            <span v-if="message.content">{{ message.content }}</span>
            <LoaderCircle v-if="message.pending" class="spin pending-icon" :size="18" />
            <div
              v-if="message.role === 'assistant' && (message.firstTokenMs !== undefined || message.totalMs !== undefined)"
              class="message-metrics"
            >
              <span>首字 {{ formatDuration(message.firstTokenMs) }}</span>
              <span>总耗时 {{ formatDuration(message.totalMs) }}</span>
            </div>
          </div>
        </article>
      </div>

      <footer class="composer">
        <div class="composer-options">
          <el-radio-group v-model="outputMode" class="mode-switch" size="small" :disabled="loading">
            <el-radio-button
              v-for="item in dictionaryItems('output_mode')"
              :key="item.item_code"
              :value="item.item_code"
            >
              {{ item.item_name }}
            </el-radio-button>
          </el-radio-group>
          <el-button
            class="clear-chat-button"
            :icon="Trash2"
            size="small"
            :disabled="loading && !abortController"
            @click="clearConversation"
          >
            清空对话
          </el-button>
        </div>
        <div class="composer-input">
          <el-input
            v-model="input"
            class="composer-textarea"
            :disabled="loading"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            placeholder="输入问题"
            @keydown.enter.exact.prevent="handleSend"
          />
          <el-button
            v-if="loading"
            class="send-button"
            :icon="Square"
            type="danger"
            size="large"
            @click="stopGenerating"
          >
            停止
          </el-button>
          <el-button
            v-else
            class="send-button"
            :icon="Send"
            type="primary"
            size="large"
            @click="handleSend"
          >
            发送
          </el-button>
          <el-select
            v-model="modelMode"
            class="model-mode-select"
            size="large"
            :disabled="loading"
            :teleported="false"
          >
            <el-option
              v-for="item in dictionaryItems('model_mode')"
              :key="item.item_code"
              :label="item.item_name"
              :value="item.item_code"
            />
          </el-select>
          <el-select
            v-model="selectedCollectionName"
            class="collection-select"
            size="large"
            filterable
            allow-create
            default-first-option
            :disabled="loading"
            :teleported="false"
          >
            <el-option
              v-for="collectionName in collectionOptions"
              :key="collectionName"
              :label="collectionName"
              :value="collectionName"
            />
          </el-select>
        </div>
      </footer>
    </section>

    <el-dialog
      v-model="dictionaryDialogVisible"
      :class="['dictionary-dialog', `theme-${themeMode}`]"
      title="字典表"
      width="1080px"
    >
      <div class="dialog-toolbar">
        <div class="dialog-toolbar-main">
          <div>
            <strong>{{ activeDictionaryGroup ? activeDictionaryGroup.dictionary_name : dictionaryGroups.length }}</strong>
            <span>{{ activeDictionaryGroup ? activeDictionaryGroup.dictionary_code : '组字典' }}</span>
            <em>{{ activeDictionaryGroup ? `${dictionaryGroupItemCount(activeDictionaryGroup)} 个字典项` : '点击父级字典进入子集' }}</em>
          </div>
        </div>
        <div class="dialog-actions">
          <el-button v-if="activeDictionaryGroup" :icon="ArrowLeft" @click="backToDictionaryGroups">
            返回父级
          </el-button>
          <el-button v-if="!activeDictionaryGroup" type="primary" @click="openCreateDictionaryGroupDialog">
            新增父级
          </el-button>
          <el-button v-if="activeDictionaryGroup" type="primary" @click="openCreateDictionaryItemDialog">
            新增字典项
          </el-button>
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
          <el-button :icon="RefreshCw" :loading="dictionaryLoading" @click="refreshDictionaries">
            刷新
          </el-button>
        </div>
      </div>

      <div v-loading="dictionaryLoading" class="dictionary-dialog-body">
        <div v-if="dictionaryGroups.length === 0" class="empty-knowledge">
          暂无字典项
        </div>
        <template v-else-if="!activeDictionaryGroup">
          <div class="dictionary-parent-grid">
            <button
              v-for="group in pagedDictionaryGroups"
              :key="group.dictionary_code"
              type="button"
              class="dictionary-parent-card"
              @click="openDictionaryGroup(group)"
            >
              <span class="dictionary-parent-icon">
                <DatabaseZap :size="18" />
              </span>
              <span class="dictionary-parent-content">
                <strong>{{ group.dictionary_name }}</strong>
                <code>{{ group.dictionary_code }}</code>
                <em>{{ dictionaryGroupItemCount(group) }} 个字典项</em>
              </span>
              <span class="dictionary-parent-actions">
                <el-button
                  :icon="Pencil"
                  circle
                  size="small"
                  @click.stop="openEditDictionaryGroupDialog(group)"
                />
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
                  <el-button size="small" @click="openEditDictionaryItemDialog(row)">
                    修改
                  </el-button>
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
          :total="dictionaryGroups.length"
          @current-change="handleDictionaryPageChange"
        />
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryGroupDialogVisible"
      :class="['dictionary-dialog', `theme-${themeMode}`]"
      :title="editingDictionaryGroupCode ? '修改父级字典' : '新增父级字典'"
      width="560px"
    >
      <el-form class="dictionary-form" label-position="top">
        <el-form-item label="父级字典编码">
          <el-input
            v-model="dictionaryGroupForm.dictionaryCode"
            :disabled="Boolean(editingDictionaryGroupCode)"
            placeholder="例如：model_mode"
          />
        </el-form-item>
        <el-form-item label="父级字典名称">
          <el-input v-model="dictionaryGroupForm.dictionaryName" placeholder="例如：回答模型档位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryGroupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictionaryGroupSaving" @click="saveDictionaryGroup">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryItemDialogVisible"
      :class="['dictionary-dialog', `theme-${themeMode}`]"
      :title="editingDictionaryItemId ? '修改字典项' : '新增字典项'"
      width="720px"
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
            <el-switch
              v-model="dictionaryForm.enabled"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
            />
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="dictionaryForm.description" />
          </el-form-item>
        </div>
        <el-form-item label="扩展元数据 JSON">
          <el-input
            v-model="dictionaryForm.metadataText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder='例如：{"default": true}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryItemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictionaryItemSaving" @click="saveDictionaryItem">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="knowledgeDialogVisible"
      :class="['knowledge-dialog', `theme-${themeMode}`]"
      title="知识库管理"
      width="1180px"
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
          <el-button
            :icon="RefreshCw"
            :loading="reindexingAll"
            type="warning"
            plain
            @click="handleReindexAllKnowledgeFiles"
          >
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
        <div v-if="knowledgeFiles.length === 0" class="empty-knowledge">
          暂无知识库文件
        </div>
        <div v-else-if="filteredKnowledgeFiles.length === 0" class="empty-knowledge">
          没有匹配的知识库文件
        </div>
        <div v-else class="knowledge-grid">
          <article
            v-for="file in pagedKnowledgeFiles"
            :key="file.document_id"
            class="knowledge-file"
          >
            <div class="knowledge-file-main">
              <FileText :size="18" />
              <div class="knowledge-file-info">
                <strong>{{ file.filename }}</strong>
                <span>
                  {{ file.file_type.toUpperCase() }} · {{ formatFileSize(file.file_size) }} · {{ file.chunk_count }} chunks
                </span>
              </div>
              <el-tag :type="knowledgeStatusType(file.status)" effect="plain" size="small">
                {{ file.status }}
              </el-tag>
            </div>
            <div class="knowledge-file-meta">
              <span>版本 v{{ file.version }}</span>
              <span>{{ formatDateTime(file.updated_at) }}</span>
            </div>
            <div v-if="file.error_message" class="knowledge-error">
              {{ file.error_message }}
            </div>
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
          @current-change="handleKnowledgePageChange"
        />
      </template>
    </el-dialog>

    <el-dialog
      v-model="conversationDialogVisible"
      :class="['conversation-dialog', `theme-${themeMode}`]"
      title="聊天记录"
      width="1220px"
    >
      <div class="conversation-layout">
        <section class="conversation-list-panel">
          <div class="dialog-toolbar slim">
            <div class="dialog-toolbar-main">
              <div>
                <strong>{{ conversationTotal }}</strong>
                <span>条会话</span>
              </div>
              <el-input
                v-model="conversationKeyword"
                class="dialog-search-input"
                clearable
                :prefix-icon="Search"
                placeholder="按会话名称模糊查询"
              />
            </div>
            <el-button :icon="RefreshCw" :loading="conversationLoading" @click="refreshConversations">
              刷新
            </el-button>
          </div>

          <div v-loading="conversationLoading" class="conversation-list">
            <article
              v-for="conversation in conversations"
              :key="conversation.conversation_id"
              class="conversation-item"
              :class="{ active: selectedConversation?.conversation.conversation_id === conversation.conversation_id }"
              @click="openConversationDetail(conversation)"
            >
              <span class="conversation-icon"><MessageSquareText :size="17" /></span>
              <span class="conversation-item-content">
                <strong>{{ conversation.title || '未命名会话' }}</strong>
                <em>{{ conversation.user_id || '未绑定用户' }} · {{ conversation.message_count }} 条消息</em>
              </span>
              <small>{{ formatDateTime(conversation.last_message_at || conversation.updated_at) }}</small>
              <el-button
                class="conversation-delete-button"
                :icon="Trash2"
                plain
                size="small"
                type="danger"
                :loading="activeConversationAction === conversationActionKey('delete', conversation.conversation_id)"
                :disabled="Boolean(activeConversationAction)"
                @click.stop="handleDeleteConversation(conversation)"
              >
                删除
              </el-button>
            </article>
            <div v-if="!conversationLoading && conversations.length === 0" class="empty-knowledge">
              {{ conversationKeyword.trim() ? '没有匹配的聊天记录' : '暂无聊天记录' }}
            </div>
          </div>

          <el-pagination
            v-model:current-page="conversationPage"
            background
            small
            layout="prev, pager, next"
            :page-size="conversationPageSize"
            :total="conversationTotal"
            @current-change="handleConversationPageChange"
          />
        </section>

        <section v-loading="conversationDetailLoading" class="conversation-detail-panel">
          <div v-if="!selectedConversation" class="conversation-placeholder">
            <MessageSquareText :size="34" />
            <span>选择左侧会话查看详情</span>
          </div>
          <template v-else>
            <div class="conversation-detail-header">
              <div>
                <strong>{{ selectedConversation.conversation.title || '未命名会话' }}</strong>
                <span>{{ selectedConversation.conversation.conversation_id }}</span>
              </div>
              <div class="conversation-detail-actions">
                <el-tag effect="plain">{{ selectedConversation.conversation.message_count }} 条消息</el-tag>
                <el-button :icon="MessageCirclePlus" type="primary" size="small" @click="continueConversation">
                  继续聊天
                </el-button>
              </div>
            </div>
            <div class="conversation-messages">
              <article
                v-for="message in selectedConversation.messages"
                :key="message.message_id"
                class="history-message"
                :class="message.role"
              >
                <div class="history-message-meta">
                  <span>{{ messageRoleLabel(message.role) }}</span>
                  <small>{{ formatDateTime(message.created_at) }}</small>
                </div>
                <p>{{ message.content }}</p>
              </article>
            </div>
          </template>
        </section>
      </div>
    </el-dialog>

    <el-dialog
      v-model="knowledgePreviewVisible"
      :class="['knowledge-preview-dialog', `theme-${themeMode}`]"
      title="文件预览"
      width="900px"
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
      :class="['upload-preview-dialog', `theme-${themeMode}`]"
      title="确认入库配置"
      width="640px"
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
            <span v-if="uploadRecommendation">
              {{ uploadRecommendation.model_name }} · {{ uploadRecommendation.sample_chars }} 字符样本
            </span>
            <span v-else>需要更精细切分时，可以让模型读取结构样本后推荐。</span>
          </div>
          <el-button
            :icon="Bot"
            :loading="recommendingKnowledge"
            :disabled="confirmingKnowledge"
            type="primary"
            plain
            @click="handleRecommendKnowledgeUpload"
          >
            模型推荐
          </el-button>
        </div>

        <div class="preview-form">
          <label>
            <span>Collection</span>
            <el-select
              v-model="selectedUploadCollection"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入 Collection"
            >
              <el-option
                v-for="collectionName in collectionOptions"
                :key="collectionName"
                :label="collectionName"
                :value="collectionName"
              />
            </el-select>
          </label>
          <label>
            <span>文档结构</span>
            <el-select v-model="selectedDocumentType" placeholder="选择文档结构">
              <el-option
                v-for="item in dictionaryItems('document_structure')"
                :key="item.item_code"
                :label="item.item_name"
                :value="item.item_code"
              />
            </el-select>
          </label>
          <label>
            <span>切分策略</span>
            <el-select v-model="selectedSplitStrategy" placeholder="选择切分策略">
              <el-option
                v-for="item in dictionaryItems('split_strategy')"
                :key="item.item_code"
                :label="item.item_name"
                :value="item.item_code"
              />
            </el-select>
          </label>
        </div>

        <div class="preview-reasons">
          <span>{{ uploadRecommendation ? '模型推荐原因' : '默认原因' }}</span>
          <p v-for="reason in (uploadRecommendation?.reasons || uploadPreview.reasons)" :key="reason">
            {{ reason }}
          </p>
        </div>

        <div class="preview-sample">
          <span>文本预览</span>
          <pre>{{ uploadPreview.sample_text }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button :disabled="confirmingKnowledge" @click="uploadPreviewVisible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="confirmingKnowledge" @click="handleConfirmKnowledgeUpload">
          确认入库
        </el-button>
      </template>
    </el-dialog>
  </main>
</template>
