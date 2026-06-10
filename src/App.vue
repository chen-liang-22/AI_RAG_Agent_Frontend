<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue' // ref 创建响应式数据；nextTick 等 DOM 更新；onMounted 页面挂载后执行
import {
  Bot, // 机器人图标
  DatabaseZap, // 知识库图标
  FileText, // 文件图标
  LoaderCircle, // 加载中旋转图标
  RefreshCw, // 刷新图标
  Search, // 检索调试图标
  Send, // 发送图标
  ShieldCheck, // 服务状态图标
  Square, // 停止生成图标
  Trash2, // 清空对话图标
  Upload, // 上传文件图标
  Wifi, // 接口地址图标
} from 'lucide-vue-next' // lucide 图标库
import { ElMessage, ElMessageBox } from 'element-plus' // Element Plus 的全局消息提示和确认弹窗
import {
  API_BASE_URL, // 当前前端请求后端的基础地址，例如 /api
  confirmKnowledgeUpload, // 确认上传预览结果并正式入库
  debugRetrieve, // 调试后端 RAG 检索链路
  deleteKnowledgeFile, // 删除后端知识库文件
  fetchHealth, // 调用后端健康检查接口
  listKnowledgeFiles, // 查询后端知识库文件列表
  reloadKnowledge, // 调用后端知识库重载接口
  reindexAllKnowledgeFiles, // 重新索引全部知识库文件
  reindexKnowledgeFile, // 重新索引后端知识库文件
  sendChat, // 调用一次性聊天接口
  sendChatStream, // 调用流式聊天接口
  previewKnowledgeFile, // 上传文件并获取文档类型预览
  type HealthResponse, // 健康检查响应类型
  type DebugRetrieveResponse, // 检索调试接口响应类型
  type KnowledgeFileResponse, // 知识库文件响应类型
  type KnowledgeUploadPreviewResponse, // 上传预览响应类型
} from './api' // 前端 API 请求封装

interface ChatMessage { // 页面聊天消息的数据结构
  id: number // 消息唯一 ID，用于 v-for key
  role: 'user' | 'assistant' // 消息角色：用户或助手
  content: string // 消息正文
  pending?: boolean // 助手消息是否还在生成中
}

type OutputMode = 'stream' | 'once' // 输出模式：流式或一次性

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
const knowledgeFileInput = ref<HTMLInputElement | null>(null) // 隐藏的文件选择框，用于触发本地文件选择
const uploadPreviewVisible = ref(false) // 上传预览弹窗是否可见
const uploadPreview = ref<KnowledgeUploadPreviewResponse | null>(null) // 当前上传文件的预解析结果
const selectedDocumentType = ref('general') // 用户确认后的文档类型
const selectedSplitStrategy = ref('recursive') // 用户确认后的切分策略
const debugQuery = ref('扫地机器人迷路怎么办？') // 检索调试默认问题
const debugLoading = ref(false) // 是否正在调用 /debug/retrieve
const debugResult = ref<DebugRetrieveResponse | null>(null) // 检索调试结果

// outputMode 控制本次发送使用哪种接口：
// - stream：调用 `/chat/stream`，后端通过 SSE 一段段返回，页面实时追加。
// - once：调用 `/chat`，后端完整生成后返回 JSON，页面一次性展示。
const outputMode = ref<OutputMode>('stream') // 默认使用流式输出

// userId 会随每次请求传给后端。
// 后端工具 get_user_id 会读取这个值，再用于查询用户外部数据或生成报告。
const userId = ref(generateUserId()) // 当前会话用户 ID
const health = ref<HealthResponse | null>(null) // 后端健康状态，初始为空

// messages 是页面聊天记录。
// 注意：流式输出时必须通过 messages.value[index] 更新消息，
// 这样 Vue 才能追踪到 content 的变化并立即重新渲染。
const messages = ref<ChatMessage[]>([welcomeMessage(userId.value)]) // 页面消息列表，初始放一条欢迎消息
const messageList = ref<HTMLElement | null>(null) // 消息列表 DOM 引用，用于滚动到底部

// abortController 保存当前请求的取消控制器。
// 用户点击“停止”时，会调用 abortController.abort() 中断 fetch。
const abortController = ref<AbortController | null>(null) // 当前请求的取消控制器

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
  } catch {
    health.value = { // 健康检查失败时，给页面一个降级状态
      status: 'degraded', // 整体服务降级
      qdrant: 'unavailable', // Qdrant 不可用
      collection_name: 'agent', // 默认 collection 名称
      collections: [], // collection 列表为空
    }
  }
}

function knowledgeStatusType(status: string) { // 把后端状态映射成 Element Plus tag 样式
  if (status === 'indexed') return 'success' // 已完成索引，用绿色
  if (status === 'failed') return 'danger' // 入库失败，用红色
  if (status === 'indexing') return 'warning' // 正在入库，用黄色
  return 'info' // uploaded 等其它状态，用灰色
}

function formatFileSize(size: number) { // 把字节数格式化成更易读的大小
  if (size < 1024) return `${size} B` // 小于 1KB 直接显示字节
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB` // 小于 1MB 显示 KB
  return `${(size / 1024 / 1024).toFixed(1)} MB` // 其它显示 MB
}

function formatDateTime(value: string) { // 格式化后端返回的 ISO 时间字符串
  return value.replace('T', ' ').slice(0, 19) // 保留到秒，避免列表太长
}

function knowledgeActionKey(action: string, documentId: string) { // 拼接文件操作唯一 key
  return `${action}:${documentId}` // 用于判断当前行哪个按钮正在 loading
}

async function refreshKnowledgeFiles() { // 刷新知识库文件列表
  knowledgeLoading.value = true // 打开列表 loading
  try {
    knowledgeFiles.value = await listKnowledgeFiles() // 调用后端文件列表接口
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识库文件列表加载失败') // 展示错误
  } finally {
    knowledgeLoading.value = false // 关闭列表 loading
  }
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
      ElMessage.info('相同内容的文件已经存在，本次没有重复入库') // 展示重复提示
      await refreshKnowledgeFiles() // 刷新文件列表
      return // 重复文件不进入确认弹窗
    }
    uploadPreview.value = response // 保存预览结果
    selectedDocumentType.value = response.detected_type // 默认采用系统识别类型
    selectedSplitStrategy.value = response.split_strategy // 默认采用系统识别切分策略
    uploadPreviewVisible.value = true // 打开用户确认弹窗
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件预解析失败') // 展示错误
  } finally {
    uploadingKnowledge.value = false // 关闭上传按钮 loading
    target.value = '' // 清空 input 值，允许再次选择同一个文件
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
    ) // 调用后端确认入库接口
    if (response.status === 'duplicate') { // 确认阶段再次发现重复
      ElMessage.info(response.message || '相同内容的文件已经存在') // 展示重复提示
    } else {
      ElMessage.success(response.message || '文件已写入知识库') // 展示成功提示
    }
    uploadPreviewVisible.value = false // 关闭弹窗
    uploadPreview.value = null // 清空预览状态
    await refreshKnowledgeFiles() // 刷新文件列表
    await refreshHealth() // 刷新 Qdrant 状态
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件入库失败') // 展示错误
  } finally {
    confirmingKnowledge.value = false // 关闭 loading
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
  try {
    await ElMessageBox.confirm( // 批量重建会消耗 embedding 调用，先让用户确认
      '确定清空旧向量并重新索引全部知识库文件吗？这个操作会重新生成向量，文件多时会比较慢。',
      '清空并重建',
      {
        confirmButtonText: '清空并重建',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return // 用户取消确认时退出
  }

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
  try {
    await ElMessageBox.confirm( // 删除会移除 Qdrant 向量和 SQLite knowledge_units，先让用户确认
      `确定删除「${file.filename}」吗？`,
      '删除知识库文件',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return // 用户取消确认时退出
  }

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

async function handleDebugRetrieve() { // 调试 RAG 检索链路
  const query = debugQuery.value.trim() // 去掉首尾空格
  if (!query || debugLoading.value) return // 空问题或正在调试时直接退出

  debugLoading.value = true // 打开调试按钮 loading
  try {
    debugResult.value = await debugRetrieve(query) // 调用后端 /debug/retrieve
    ElMessage.success('检索调试完成') // 成功提示
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '检索调试失败') // 展示错误
  } finally {
    debugLoading.value = false // 关闭 loading
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

function clearConversation() { // 清空当前对话
  // 清空对话时如果正在生成，先中断当前请求，避免旧请求继续写入已经清空的消息列表。
  if (loading.value) { // 如果正在生成
    stopGenerating() // 先停止生成，避免旧流继续写入
  }

  userId.value = generateUserId(userId.value) // 换一个新的用户 ID
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
    if (outputMode.value === 'stream') { // 当前选择“流式输出”
      // 流式输出路径：
      // - sendChatStream 内部会读取后端 SSE。
      // - 每解析到一个 {"content": "..."} 事件，就调用这里的回调。
      // - 回调只做两件事：追加文本、等待页面滚动到底部。
      await sendChatStream( // 调用流式接口
        question, // 用户问题
        userId.value, // 当前用户 ID
        async (chunk) => { // 每收到一个 chunk，就执行这个回调
          messages.value[assistantMessageIndex].content += chunk // 把 chunk 追加到助手消息正文
          await scrollToBottom() // DOM 更新后滚动到底部
        },
        controller.signal, // 传入取消信号，支持停止生成
      )
    } else {
      // 一次性输出路径：
      // - sendChat 会等待 `/chat` 返回完整 JSON。
      // - response.answer 已经是最终完整回答。
      // - 页面只赋值一次，因此不会出现逐字/逐段渲染。
      const response = await sendChat(question, userId.value, controller.signal) // 调用一次性接口并等待完整回答
      messages.value[assistantMessageIndex].content = response.answer || '没有返回内容' // 一次性填充助手消息
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
})
</script>

<template>
  <main class="app-shell">
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
          <el-button :icon="RefreshCw" circle size="small" @click="refreshHealth" />
        </div>
        <div class="status-grid">
          <div class="status-row">
            <span>API</span>
            <el-tag :type="health?.status === 'ok' ? 'success' : 'warning'" effect="plain">
              {{ health?.status || 'checking' }}
            </el-tag>
          </div>
          <div class="status-row">
            <span>Qdrant</span>
            <el-tag :type="health?.qdrant === 'ok' ? 'success' : 'danger'" effect="plain">
              {{ health?.qdrant || 'checking' }}
            </el-tag>
          </div>
          <div class="status-row">
            <span>Collection</span>
            <code>{{ health?.collection_name || 'agent' }}</code>
          </div>
          <div class="status-row">
            <span>用户 ID</span>
            <code>{{ userId }}</code>
          </div>
        </div>
      </section>

      <section class="status-block">
        <div class="section-title">
          <DatabaseZap :size="18" />
          <span>知识库</span>
          <el-button
            :icon="RefreshCw"
            circle
            size="small"
            :loading="knowledgeLoading"
            @click="refreshKnowledgeFiles"
          />
        </div>
        <input
          ref="knowledgeFileInput"
          class="hidden-file-input"
          type="file"
          accept=".txt,.pdf"
          @change="handleKnowledgeFileChange"
        >
        <div class="knowledge-toolbar">
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
            :icon="RefreshCw"
            :loading="reindexingAll"
            type="warning"
            plain
            @click="handleReindexAllKnowledgeFiles"
          >
            清空并重建
          </el-button>
          <el-button
            class="full-button"
            :icon="DatabaseZap"
            :loading="reloading"
            plain
            @click="handleReloadKnowledge"
          >
            扫描 data
          </el-button>
        </div>
        <div v-loading="knowledgeLoading" class="knowledge-list">
          <div v-if="knowledgeFiles.length === 0" class="empty-knowledge">
            暂无文件
          </div>
          <template v-else>
            <article
              v-for="file in knowledgeFiles"
              :key="file.document_id"
              class="knowledge-file"
            >
              <div class="knowledge-file-main">
                <FileText :size="17" />
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
                <span>v{{ file.version }}</span>
                <span>{{ formatDateTime(file.updated_at) }}</span>
              </div>
              <div v-if="file.error_message" class="knowledge-error">
                {{ file.error_message }}
              </div>
              <div class="knowledge-file-actions">
                <el-tooltip content="重新索引" placement="top">
                  <el-button
                    :icon="RefreshCw"
                    circle
                    size="small"
                    :loading="activeKnowledgeAction === knowledgeActionKey('reindex', file.document_id)"
                    :disabled="Boolean(activeKnowledgeAction)"
                    @click="handleReindexKnowledgeFile(file)"
                  />
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button
                    :icon="Trash2"
                    circle
                    plain
                    size="small"
                    type="danger"
                    :loading="activeKnowledgeAction === knowledgeActionKey('delete', file.document_id)"
                    :disabled="Boolean(activeKnowledgeAction)"
                    @click="handleDeleteKnowledgeFile(file)"
                  />
                </el-tooltip>
              </div>
            </article>
          </template>
        </div>
      </section>

      <section class="status-block">
        <div class="section-title">
          <Wifi :size="18" />
          <span>接口地址</span>
        </div>
        <code class="endpoint">{{ API_BASE_URL }}</code>
      </section>

      <section class="status-block debug-block">
        <div class="section-title">
          <Search :size="18" />
          <span>检索调试</span>
        </div>
        <div class="debug-input">
          <el-input
            v-model="debugQuery"
            placeholder="输入调试问题"
            size="small"
            @keyup.enter="handleDebugRetrieve"
          />
          <el-button
            :icon="Search"
            :loading="debugLoading"
            size="small"
            type="primary"
            @click="handleDebugRetrieve"
          >
            检索
          </el-button>
        </div>
        <div v-if="debugResult" class="debug-result">
          <div class="debug-row">
            <span>意图</span>
            <div class="debug-tags">
              <el-tag
                v-for="intent in debugResult.intents"
                :key="intent"
                effect="plain"
                size="small"
              >
                {{ intent }}
              </el-tag>
            </div>
          </div>
          <div class="debug-row">
            <span>候选</span>
            <code>{{ debugResult.candidate_count }}</code>
          </div>
          <div class="debug-subqueries">
            <span>子查询</span>
            <p
              v-for="subQuery in debugResult.sub_queries"
              :key="subQuery"
            >
              {{ subQuery }}
            </p>
          </div>
          <div class="debug-reranked">
            <article
              v-for="item in debugResult.reranked.slice(0, 3)"
              :key="`${item.rerank_score}-${item.content.slice(0, 20)}`"
              class="debug-doc"
            >
              <div>
                <span>rerank {{ item.rerank_score ?? '-' }}</span>
                <span>vector {{ item.vector_score ?? '-' }}</span>
              </div>
              <p>{{ item.content }}</p>
            </article>
          </div>
        </div>
      </section>
    </aside>

    <section class="chat-panel">
      <header class="chat-header">
        <div>
          <h2>智能客服</h2>
          <p>RAG 检索 + ReAct 工具调用</p>
        </div>
        <div class="quick-actions">
          <el-button size="small" @click="askPreset('小户型适合哪些扫地机器人？')">
            小户型适配
          </el-button>
          <el-button size="small" @click="askPreset('扫地机器人迷路怎么办？')">
            故障排查
          </el-button>
          <el-button size="small" @click="askPreset('给我生成我的使用报告')">
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
          </div>
        </article>
      </div>

      <footer class="composer">
        <div class="composer-options">
          <el-radio-group v-model="outputMode" size="small" :disabled="loading">
            <el-radio-button value="stream">流式输出</el-radio-button>
            <el-radio-button value="once">一次性输出</el-radio-button>
          </el-radio-group>
          <el-button :icon="Trash2" size="small" :disabled="loading && !abortController" @click="clearConversation">
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
            :icon="Square"
            type="danger"
            size="large"
            @click="stopGenerating"
          >
            停止
          </el-button>
          <el-button
            v-else
            :icon="Send"
            type="primary"
            size="large"
            @click="handleSend"
          >
            发送
          </el-button>
        </div>
      </footer>
    </section>

    <el-dialog
      v-model="uploadPreviewVisible"
      class="upload-preview-dialog"
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
            <span>置信度</span>
            <strong>{{ Math.round(uploadPreview.confidence * 100) }}%</strong>
          </div>
        </div>

        <div class="preview-form">
          <label>
            <span>文档类型</span>
            <el-select v-model="selectedDocumentType" placeholder="选择文档类型">
              <el-option label="常见问答 FAQ" value="faq" />
              <el-option label="说明书/手册" value="manual" />
              <el-option label="故障排查" value="troubleshooting" />
              <el-option label="维护保养" value="maintenance" />
              <el-option label="售后政策" value="policy" />
              <el-option label="参数规格" value="spec" />
              <el-option label="普通文档" value="general" />
            </el-select>
          </label>
          <label>
            <span>切分策略</span>
            <el-select v-model="selectedSplitStrategy" placeholder="选择切分策略">
              <el-option label="编号问答切分" value="numbered_qa" />
              <el-option label="编号条目切分" value="numbered_segments" />
              <el-option label="递归通用切分" value="recursive" />
            </el-select>
          </label>
        </div>

        <div class="preview-reasons">
          <span>识别原因</span>
          <p v-for="reason in uploadPreview.reasons" :key="reason">
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
