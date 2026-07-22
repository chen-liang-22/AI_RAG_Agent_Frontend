<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue' // ref 创建响应式数据；computed 创建派生数据；nextTick 等 DOM 更新；watch 监听主题变化；onMounted 页面挂载后执行
import {
  Bot, // 机器人图标
  Clock3, // 聊天记录图标
  MessageCirclePlus, // 继续聊天图标
  LoaderCircle, // 加载中旋转图标
  MessageSquareText, // 会话详情图标
  Moon, // 深色模式图标
  RefreshCw, // 刷新图标
  Search, // 搜索/故障排查图标
  Send, // 发送图标
  ShieldCheck, // 服务状态图标
  Square, // 停止生成图标
  Sun, // 浅色模式图标
  Trash2, // 清空对话图标
} from 'lucide-vue-next' // lucide 图标库
import { ElMessage, ElMessageBox } from 'element-plus' // Element Plus 的全局消息提示和确认弹窗
import {
  deleteConversation, // 删除后端聊天记录
  fetchHealth, // 调用后端健康检查接口
  getConversationDetail, // 查询聊天记录详情
  listConversations, // 分页查询聊天记录
  listDictionaries, // 查询系统字典表
  listKnowledgeFiles, // 查询后端知识库文件列表
  sendChat, // 调用一次性聊天接口
  sendChatStream, // 调用流式聊天接口
  type HealthResponse, // 健康检查响应类型
  type ConversationDetailResponse, // 聊天记录详情响应类型
  type ConversationSummaryResponse, // 聊天记录列表项响应类型
  type DictionaryGroupResponse, // 字典分组响应类型
  type DictionaryItemResponse, // 字典项响应类型
  type KnowledgeFileResponse, // 知识库文件响应类型
  type ChatModelName, // 聊天模型名称类型
  type AuthUser, // 当前登录用户类型
} from '../../../shared/api' // 前端 API 请求封装

const props = defineProps<{
  themeMode?: ThemeMode
  historyRequest?: { token: number; conversationId: string } | null
  currentUser?: AuthUser | null
}>()

interface ChatMessage { // 页面聊天消息的数据结构
  id: number // 消息唯一 ID，用于 v-for key
  role: 'user' | 'assistant' // 消息角色：用户或助手
  content: string // 消息正文
  pending?: boolean // 助手消息是否还在生成中
  modelName?: ChatModelName | null // 助手回答实际使用的聊天模型
  firstTokenMs?: number | null // 助手首字/首片返回耗时
  totalMs?: number | null // 助手完整回答总耗时
}

type OutputMode = string // 输出模式，具体可选值来自 output_mode 字典
type ThemeMode = 'dark' | 'light' // 页面主题模式：深色科技风或浅色商务风

const userPool = ['1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', '1009', '1010'] // 模拟用户 ID 池

function generateUserId(excludeUserId?: string) { // 生成一个用户 ID
  // 清空对话时需要生成一个新的 userId。
  // excludeUserId 用来避免随机结果仍然等于当前用户，保证“新会话”真的换了用户。
  const candidates = excludeUserId ? userPool.filter((id) => id !== excludeUserId) : userPool // 排除当前用户 ID
  const source = candidates.length > 0 ? candidates : userPool // 如果排除后还有候选，就用候选；否则兜底用完整池
  return source[Math.floor(Math.random() * source.length)] // 从候选池中随机取一个
}

function resolveUserDisplayName(currentUser?: AuthUser | null) { // 读取当前用户展示名称
  // 页面只展示用户名称，不暴露后端 user_id；请求参数仍使用真实 user_id 保证会话归属准确。
  const displayName = currentUser?.display_name?.trim()
  if (displayName) return displayName

  const username = currentUser?.username?.trim()
  if (username) return username

  return '当前用户'
}

function welcomeMessage(userDisplayName: string): ChatMessage { // 创建欢迎消息
  // 每次新会话都会放入一条助手欢迎消息，顺便把当前用户名称展示给用户。
  return { // 返回一条助手消息对象
    id: Date.now(), // 用当前时间戳作为消息 ID
    role: 'assistant', // 欢迎语由助手发出
    content: `你好，我是扫地/扫拖机器人智能客服。当前用户：${userDisplayName}。可以问我选购、故障、保养和个人使用报告。`, // 欢迎语正文
  }
}

function isWelcomeMessage(message?: ChatMessage) { // 判断当前消息是否是默认欢迎语
  // 用户名异步刷新或热更新后，只替换系统生成的欢迎语，避免误改真实聊天内容。
  return message?.role === 'assistant'
    && message.content.includes('扫地/扫拖机器人智能客服')
    && (message.content.includes('当前用户') || message.content.includes('当前用户 ID'))
}

const input = ref('') // 输入框内容
const loading = ref(false) // 是否正在生成回答
const knowledgeFiles = ref<KnowledgeFileResponse[]>([]) // 聊天 collection 下拉使用的只读知识库文件列表
const conversationDialogVisible = ref(false) // 聊天记录弹窗是否可见
const conversationLoading = ref(false) // 聊天记录列表是否加载中
const conversationDetailLoading = ref(false) // 聊天记录详情是否加载中
const conversationPage = ref(1) // 聊天记录当前页码
const conversationPageSize = 10 // 聊天记录每页 10 条，和历史记录弹窗的分页展示要求保持一致
const conversationTotal = ref(0) // 聊天记录总数
const conversations = ref<ConversationSummaryResponse[]>([]) // 当前页聊天记录
const conversationKeyword = ref('') // 聊天记录名称模糊查询关键词
const selectedConversation = ref<ConversationDetailResponse | null>(null) // 当前选中的聊天记录详情
const activeConversationAction = ref('') // 当前正在执行的会话操作，用于控制单行按钮 loading
const dictionaryLoading = ref(false) // 是否正在加载字典表
const dictionaryGroups = ref<DictionaryGroupResponse[]>([]) // 后端返回的字典分组列表
const themeMode = ref<ThemeMode>(props.themeMode || readInitialThemeMode()) // 当前页面主题，默认深色并支持本地持久化
const themeToggleIcon = computed(() => (themeMode.value === 'dark' ? Sun : Moon)) // 当前主题切换按钮图标

// outputMode 控制本次发送使用哪种接口：
// - stream：调用 `/chat/stream`，后端通过 SSE 一段段返回，页面实时追加。
// - once：调用 `/chat`，后端完整生成后返回 JSON，页面一次性展示。
const outputMode = ref<OutputMode>('') // 输出模式，默认值由 output_mode 字典提供
const modelName = ref<ChatModelName>('') // 显式选择的聊天模型；为空时由 Prompt 配置决定
const selectedCollectionName = ref('agent') // 当前聊天检索使用的 Qdrant collection

// userId 会随每次请求传给后端。
// 已登录时优先使用后端登录用户 ID；没有登录用户时才用随机 ID 做开发兜底。
const userId = ref(props.currentUser?.user_id || generateUserId()) // 当前会话用户 ID
const userDisplayName = computed(() => resolveUserDisplayName(props.currentUser)) // 当前页面展示的用户名称
const conversationId = ref<string | null>(null) // 当前后端会话 ID；首轮为空，由后端创建
const health = ref<HealthResponse | null>(null) // 后端健康状态，初始为空

// messages 是页面聊天记录。
// 注意：流式输出时必须通过 messages.value[index] 更新消息，
// 这样 Vue 才能追踪到 content 的变化并立即重新渲染。
const messages = ref<ChatMessage[]>([welcomeMessage(userDisplayName.value)]) // 页面消息列表，初始放一条欢迎消息
const messageList = ref<HTMLElement | null>(null) // 消息列表 DOM 引用，用于滚动到底部

// abortController 保存当前请求的取消控制器。
// 用户点击“停止”时，会调用 abortController.abort() 中断 fetch。
const abortController = ref<AbortController | null>(null) // 当前请求的取消控制器

function syncWelcomeMessageDisplayName() { // 同步欢迎语中的用户展示名称
  // 只有没有后端会话、且当前页面仍停留在默认欢迎状态时才重建欢迎语。
  if (conversationId.value || messages.value.length !== 1 || !isWelcomeMessage(messages.value[0])) return

  messages.value = [welcomeMessage(userDisplayName.value)]
}

function readInitialThemeMode(): ThemeMode { // 读取本地保存的主题，没有保存时使用深色
  if (typeof window === 'undefined') return 'dark' // 构建阶段没有 window，兜底深色
  const savedTheme = window.localStorage.getItem('ai-rag-agent-theme') // 读取上次用户选择
  return savedTheme === 'light' ? 'light' : 'dark' // 只接受明确的 light，其余都按 dark 处理
}

watch(themeMode, (nextTheme) => { // 用户切换主题后保存到浏览器
  window.localStorage.setItem('ai-rag-agent-theme', nextTheme) // 下次打开页面继续沿用当前主题
})

watch(
  () => props.themeMode,
  (nextTheme) => {
    if (nextTheme && nextTheme !== themeMode.value) {
      themeMode.value = nextTheme
    }
  },
)

watch(
  () => props.historyRequest,
  async (request) => {
    if (request?.conversationId) {
      await openConversationDialog(request.conversationId)
    }
  },
  { deep: true, immediate: true },
)

watch(
  () => props.currentUser?.user_id,
  (nextUserId) => {
    if (!nextUserId || nextUserId === userId.value) return

    userId.value = nextUserId
    syncWelcomeMessageDisplayName()
  },
)

watch(userDisplayName, () => { // 登录用户名称加载、变化或热更新后刷新默认欢迎语
  syncWelcomeMessageDisplayName()
}, { immediate: true })

watch(conversationKeyword, () => { // 聊天记录名称搜索变化时重新查询第一页
  conversationPage.value = 1
  selectedConversation.value = null
  if (conversationDialogVisible.value) {
    void refreshConversations()
  }
})

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

function flattenDictionaryItems(items: DictionaryItemResponse[]): DictionaryItemResponse[] { // 把多层级字典项拉平成列表，便于下拉控件使用
  return items.flatMap((item) => [item, ...flattenDictionaryItems(item.children || [])])
}

function allDictionaryItems(dictionaryCode: string) { // 按字典编码读取全部字典项，包含已停用项
  const group = dictionaryGroups.value.find((item) => item.dictionary_code === dictionaryCode)
  return flattenDictionaryItems(group?.items || [])
}

function dictionaryItems(dictionaryCode: string) { // 按字典编码读取启用字典项
  return allDictionaryItems(dictionaryCode).filter((item) => item.enabled)
}

const chatModelItems = computed(() => allDictionaryItems('chat_model')) // 全部聊天模型字典项，仅用于解析历史模型名称
const enabledChatModelItems = computed(() => chatModelItems.value.filter((item) => item.enabled)) // 启用的聊天模型，仅供下拉选择

function clearUnavailableChatModel() { // 字典加载完成后清除已停用或已删除的当前聊天模型
  if (modelName.value && !enabledChatModelItems.value.some((item) => item.item_code === modelName.value)) {
    modelName.value = ''
  }
}

function dictionaryDefaultCode(dictionaryCode: string) { // 取某组字典的默认编码，默认使用排序最靠前的启用项
  return dictionaryItems(dictionaryCode)[0]?.item_code || ''
}

function chatModelLabel(value: string) { // 按聊天模型字典显示名称，字典缺失时保留后端模型编码
  if (!value) return '使用 Prompt 配置'
  return chatModelItems.value.find((item) => item.item_code === value)?.item_name || value
}

function dictionaryCodeByMetadata(dictionaryCode: string, key: string, value: unknown) { // 按字典 metadata 读取具有特定业务含义的字典项编码
  return dictionaryItems(dictionaryCode).find((item) => item.metadata?.[key] === value)?.item_code || ''
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

function isOutputModeKind(kind: string) { // 判断当前输出模式是否属于某种字典配置的模式类型
  return outputMode.value === dictionaryCodeByMetadata('output_mode', 'mode_kind', kind)
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
      collection_points: {}, // Qdrant 不可用时没有向量点统计
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
    clearUnavailableChatModel() // 请求成功后再校验，避免字典初次加载前误清空用户选择
    outputMode.value ||= dictionaryDefaultCode('output_mode') // 输出模式默认取字典第一项
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典表加载失败') // 展示字典加载错误
  } finally {
    dictionaryLoading.value = false // 关闭字典加载状态
  }
}

function formatDateTime(value: string) { // 格式化后端返回的 ISO 时间字符串
  return value.replace('T', ' ').slice(0, 19) // 保留到秒，避免列表太长
}

function formatDuration(value?: number | null) { // 把毫秒耗时格式化成页面展示文本
  if (value === null || value === undefined) return '--'
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(2)}s`
}

function conversationActionKey(action: string, conversationIdValue: string) { // 拼接会话操作唯一 key
  return `${action}:${conversationIdValue}` // 用于判断当前行哪个按钮正在 loading
}

async function refreshKnowledgeFiles() { // 读取文件所属 collection，供聊天检索下拉选择
  try {
    knowledgeFiles.value = await listKnowledgeFiles() // 仅保留通用知识库文件的 collection 信息
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '聊天知识库列表加载失败') // 展示错误
  }
}

async function openConversationDialog(targetConversationId?: string) { // 打开聊天记录弹窗，可选中指定会话
  conversationDialogVisible.value = true // 展示弹窗
  selectedConversation.value = null // 默认先展示列表，不选中详情
  conversationPage.value = 1 // 每次打开从第一页开始
  await refreshConversations() // 加载第一页聊天记录
  if (targetConversationId) {
    const targetConversation = conversations.value.find((item) => item.conversation_id === targetConversationId)
    if (targetConversation) {
      await openConversationDetail(targetConversation) // 如果目标会话在第一页，列表同步高亮
      return
    }
    conversationDetailLoading.value = true
    try {
      selectedConversation.value = await getConversationDetail(targetConversationId) // 目标不在第一页时也直接展示详情
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '聊天详情加载失败')
    } finally {
      conversationDetailLoading.value = false
    }
  }
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
      messages.value = [welcomeMessage(userDisplayName.value)] // 页面也回到新会话欢迎状态
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
      modelName: message.role === 'assistant' ? message.model_name : undefined,
      firstTokenMs: message.role === 'assistant' ? message.first_token_ms : undefined,
      totalMs: message.role === 'assistant' ? message.total_ms : undefined,
    })) // 把数据库消息转换成主聊天区消息

  if (messages.value.length === 0) {
    messages.value = [welcomeMessage(userDisplayName.value)] // 极端情况下没有消息，兜底展示欢迎语
  }

  conversationDialogVisible.value = false // 关闭聊天记录弹窗
  ElMessage.success('已切换到该历史会话，可以继续聊天') // 给用户明确反馈
  await scrollToBottom() // 滚动到历史会话最新位置
}

function messageRoleLabel(role: string) { // 把消息角色编码转成页面展示文本
  return dictionaryItems('message_role').find((item) => item.item_code === role)?.item_name || role
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
    '确定清空当前页面对话吗？页面消息会被重置，并重新开始当前用户会话。',
    '清空当前对话',
    '清空对话',
  )
  if (!confirmed) return

  // 清空对话时如果正在生成，先中断当前请求，避免旧请求继续写入已经清空的消息列表。
  if (loading.value) { // 如果正在生成
    stopGenerating() // 先停止生成，避免旧流继续写入
  }

  userId.value = props.currentUser?.user_id || generateUserId(userId.value) // 登录后保持真实用户 ID，未登录兜底才换随机 ID
  conversationId.value = null // 清空后让后端创建新 conversation_id
  messages.value = [welcomeMessage(userDisplayName.value)] // 重置消息列表，只保留欢迎语
  input.value = '' // 清空输入框
  ElMessage.success(`已清空对话，当前用户：${userDisplayName.value}`) // 显示成功提示
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
        modelName.value, // 当前显式选择的聊天模型，为空时请求不覆盖 Prompt 配置
        selectedCollectionName.value, // 当前检索的 Qdrant collection
        async (chunk) => { // 每收到一个 chunk，就执行这个回调
          messages.value[assistantMessageIndex].content += chunk // 把 chunk 追加到助手消息正文
          await scrollToBottom() // DOM 更新后滚动到底部
        },
        (nextConversationId) => { // 后端在 meta/done 事件里返回会话 ID
          conversationId.value = nextConversationId // 保存后续请求使用
        },
        (metrics) => { // 后端 meta/metric/done 事件返回实际模型和耗时
          if (metrics.model_name) {
            messages.value[assistantMessageIndex].modelName = metrics.model_name // 保存实际使用的聊天模型
          }
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
        modelName.value,
        selectedCollectionName.value,
        controller.signal,
      ) // 调用一次性接口并等待完整回答
      conversationId.value = response.conversation_id || conversationId.value // 保存后续请求使用
      messages.value[assistantMessageIndex].content = response.answer || '没有返回内容' // 一次性填充助手消息
      messages.value[assistantMessageIndex].modelName = response.model_name ?? null // 保存实际使用的聊天模型
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
  void refreshKnowledgeFiles() // 页面打开后读取聊天可选的 collection
  void refreshDictionaries() // 页面打开后加载聊天模型、输出模式和消息角色字典
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
          <h1>知域</h1>
          <p>知识库智能问答</p>
        </div>
      </div>

      <section class="status-block">
        <div class="section-title">
          <Clock3 :size="18" />
          <span>会话上下文</span>
        </div>
        <div class="status-grid">
          <div class="status-row">
            <span>Collection</span>
            <span class="status-chip">{{ selectedCollectionName || health?.collection_name || 'agent' }}</span>
          </div>
          <div class="status-row">
            <span>输出模式</span>
            <span class="status-chip">{{ dictionaryItems('output_mode').find((item) => item.item_code === outputMode)?.item_name || '默认' }}</span>
          </div>
          <div class="status-row">
            <span>聊天模型</span>
            <span class="status-chip">{{ chatModelLabel(modelName) }}</span>
          </div>
          <div class="status-row">
            <span>用户</span>
            <span class="status-chip">{{ userDisplayName }}</span>
          </div>
          <div class="status-row">
            <span>会话 ID</span>
            <span class="status-chip">{{ conversationId || 'new' }}</span>
          </div>
        </div>
        <p class="panel-note">系统健康信息已集中放在首页，这里只保留当前对话所需的上下文。</p>
      </section>

    </aside>

    <section class="chat-panel">
      <header class="chat-header">
        <div>
          <h2>智能客服</h2>
          <p>知域 Nexus · 智能检索中枢</p>
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
          <el-button
            class="quick-action-button"
            :icon="Clock3"
            size="small"
            @click="openConversationDialog()"
          >
            最近会话
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
          <div class="message-content">
            <div class="bubble">
              <span v-if="message.content">{{ message.content }}</span>
              <LoaderCircle v-if="message.pending" class="spin pending-icon" :size="18" />
            </div>
            <div
              v-if="
                message.role === 'assistant'
                && (message.modelName || message.firstTokenMs !== undefined || message.totalMs !== undefined)
              "
              class="message-metrics"
            >
              <span v-if="message.modelName">模型 {{ chatModelLabel(message.modelName) }}</span>
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
            v-model="modelName"
            class="model-name-select"
            size="large"
            clearable
            placeholder="使用 Prompt 配置"
            :disabled="loading"
            :teleported="false"
          >
            <el-option
              v-for="item in enabledChatModelItems"
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
                  <small>
                    {{
                      message.model_name
                        ? `${chatModelLabel(message.model_name)} · `
                        : ''
                    }}{{ formatDateTime(message.created_at) }}
                  </small>
                </div>
                <p>{{ message.content }}</p>
              </article>
            </div>
          </template>
        </section>
      </div>
    </el-dialog>

  </main>
</template>

