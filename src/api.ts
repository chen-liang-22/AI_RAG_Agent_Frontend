export interface HealthResponse { // `/health` 接口返回的数据结构
  status: string // 后端整体状态，例如 ok/degraded
  qdrant: string // Qdrant 状态，例如 ok/unavailable
  collection_name: string // 当前使用的 Qdrant collection 名称
  collections: string[] // Qdrant 中已有的 collection 列表
}

export interface ChatResponse { // `/chat` 一次性接口返回的数据结构
  // 一次性聊天接口返回的完整回答。
  // 流式接口不会使用这个结构，而是不断收到 SSE chunk 事件。
  answer: string
  conversation_id: string
}

export interface ConversationSummaryResponse { // `/conversations` 返回的单个会话摘要
  conversation_id: string // 会话唯一 ID
  user_id?: string | null // 用户 ID
  title?: string | null // 会话标题
  status: string // 会话状态
  message_count: number // 消息数量
  created_at: string // 创建时间
  updated_at: string // 更新时间
  last_message_at?: string | null // 最后一条消息时间
}

export interface ConversationListResponse { // `/conversations` 分页响应
  items: ConversationSummaryResponse[] // 当前页会话
  total: number // 总数
  page: number // 当前页
  page_size: number // 每页数量
}

export interface ConversationMessageResponse { // `/conversations/{conversation_id}` 中的单条消息
  message_id: string // 消息 ID
  conversation_id: string // 会话 ID
  sequence_no: number // 消息顺序
  role: string // user/assistant/system
  content: string // 消息正文
  content_type: string // 消息类型
  model_name?: string | null // 模型名称
  token_count?: number | null // token 数
  created_at: string // 创建时间
}

export interface ConversationDetailResponse { // `/conversations/{conversation_id}` 详情响应
  conversation: ConversationSummaryResponse // 会话摘要
  messages: ConversationMessageResponse[] // 全部消息
}

export interface KnowledgeFileResponse { // `/knowledge/files` 返回的单个知识库文件结构
  document_id: string // 文件唯一 ID，删除和重建索引都靠它定位
  filename: string // 原始文件名
  file_path: string // 后端保存路径
  file_type: string // 文件类型，例如 txt/pdf
  file_md5: string // 文件内容 MD5，用于后端判断重复上传
  file_size: number // 文件大小，单位字节
  status: string // uploaded/indexing/indexed/failed/deleted
  version: number // 文件索引版本，reindex 后递增
  chunk_count: number // 写入 Qdrant 的知识单元数量
  created_at: string // 创建时间
  updated_at: string // 更新时间
  error_message?: string | null // 入库失败时的错误信息
}

export interface KnowledgeUploadResponse { // `/knowledge/upload/confirm` 确认入库后的响应结构
  status: 'indexed' | 'duplicate' // indexed 表示新文件入库成功，duplicate 表示相同内容已存在
  message: string // 后端返回的简短说明
  document: KnowledgeFileResponse // 对应的文件记录
}

export interface KnowledgeUploadPreviewResponse { // `/knowledge/upload/preview` 上传预览响应结构
  upload_id: string // 临时上传 ID，确认入库时使用
  filename: string // 文件名
  file_type: string // 文件类型
  file_size: number // 文件大小
  file_md5: string // 文件 MD5
  duplicate: boolean // 是否重复
  duplicate_document?: KnowledgeFileResponse | null // 重复时已有文件记录
  detected_type: string // 系统识别的文档类型
  split_strategy: string // 系统建议的切分策略
  confidence: number // 识别置信度
  reasons: string[] // 识别原因
  llm_used: boolean // 是否使用 LLM 兜底
  sample_text: string // 预览文本
}

export interface KnowledgeDeleteResponse { // `/knowledge/files/{document_id}` DELETE 响应结构
  status: string // 固定为 deleted
  document_id: string // 被删除的文件 ID
}

export interface KnowledgeReindexResult { // 全部重建索引时单个文件的结果
  document_id: string // 文件 ID
  filename: string // 文件名
  status: string // indexed 或 failed
  message?: string | null // 成功说明或失败原因
}

export interface KnowledgeBulkReindexResponse { // `/knowledge/files/reindex-all` 响应结构
  status: string // ok 或 partial_failed
  total: number // 总文件数
  succeeded: number // 成功数量
  failed: number // 失败数量
  results: KnowledgeReindexResult[] // 每个文件的重建结果
}

export interface DebugRetrieveItem { // `/debug/retrieve` 返回的单条精排结果
  content: string // 候选资料正文
  metadata: Record<string, unknown> // 后端返回的 Qdrant metadata
  vector_score?: number | null // 原始向量召回分数
  rerank_score?: number | null // 规则精排后的分数
}

export interface DebugRetrieveResponse { // `/debug/retrieve` 调试接口响应结构
  query: string // 调试的问题
  intents: string[] // 识别到的意图
  sub_queries: string[] // 生成的子查询
  filters: Record<string, string[]> // 生成的 metadata filter
  candidate_count: number // 多路召回候选数量
  groups?: Array<{ search_query: string; candidate_count: number }> // 每个 search_query 的候选数量
  reranked: DebugRetrieveItem[] // 精排后的结果
}

// API_BASE_URL 有两个典型取值：
// - 本地开发：通过 .env.development 配成 http://127.0.0.1:8000，绕过 Vite 代理，减少流式缓冲干扰。
// - Docker/Nginx 部署：使用默认 /api，由 Nginx 把 /api 转发给后端 api 容器。
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function readErrorMessage(response: Response) { // 把后端错误响应转换成更适合页面展示的文字
  const text = await response.text() // 先读取原始错误文本

  if (!text) { // 没有响应体时，用状态码兜底
    return `Request failed: ${response.status}` // 返回通用错误
  }

  try {
    const data = JSON.parse(text) // FastAPI 错误通常是 JSON，例如 {"detail":"..."}
    if (typeof data.detail === 'string') { // detail 是字符串时直接展示
      return data.detail // 返回后端 detail
    }
    if (data.detail) { // detail 是数组或对象时序列化展示
      return JSON.stringify(data.detail) // 返回结构化 detail
    }
  } catch {
    // 如果不是 JSON，就直接使用原始文本。
  }

  return text // 返回原始错误内容
}

async function request<T>(path: string, options?: RequestInit): Promise<T> { // 通用 JSON 请求函数，T 表示返回数据类型
  // 普通 JSON 请求封装。
  // `/health`、`/knowledge/reload`、`/chat` 都属于“请求完成后一次性解析 JSON”的接口。
  // 注意：这个函数会调用 response.json()，因此不能用于 `/chat/stream` 这种持续文本流接口。
  const response = await fetch(`${API_BASE_URL}${path}`, { // 发起 HTTP 请求，最终地址 = API_BASE_URL + path
    headers: { // 设置请求头
      'Content-Type': 'application/json', // 告诉后端请求体是 JSON
      ...options?.headers, // 合并调用方传入的额外请求头，调用方可以覆盖或扩展
    },
    ...options, // 合并 method、body、signal 等请求配置
  })

  if (!response.ok) { // HTTP 状态码不是 2xx 时进入错误处理
    // 后端返回非 2xx 时，优先读取原始文本，方便把 FastAPI 的错误信息展示出来。
    const message = await readErrorMessage(response) // 读取并格式化后端错误
    throw new Error(message) // 抛出错误给页面层显示
  }

  // 一次性接口在这里等待完整响应体，然后整体反序列化成 JSON。
  return response.json() as Promise<T> // 把完整响应体解析成 JSON，并按 T 类型返回
}

export function fetchHealth() { // 获取后端和 Qdrant 健康状态
  return request<HealthResponse>('/health') // GET /health，返回 HealthResponse
}

export function listConversations(page = 1, pageSize = 10, userId?: string) { // 分页查询聊天记录
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (userId) {
    params.set('user_id', userId)
  }
  return request<ConversationListResponse>(`/conversations?${params.toString()}`)
}

export function getConversationDetail(conversationId: string) { // 查询单个聊天记录详情
  return request<ConversationDetailResponse>(`/conversations/${encodeURIComponent(conversationId)}`)
}

export function reloadKnowledge() { // 触发后端重新加载知识库到 Qdrant
  return request<{ status: string; collection_name: string }>('/knowledge/reload', { // 返回简单状态对象
    method: 'POST', // 重载知识库会修改服务端状态，因此使用 POST
  })
}

export function listKnowledgeFiles() { // 获取知识库文件列表
  return request<KnowledgeFileResponse[]>('/knowledge/files') // GET /knowledge/files
}

export async function previewKnowledgeFile(file: File, signal?: AbortSignal) { // 上传文件并获取预解析结果
  // 文件上传不能手动设置 Content-Type: application/json。
  // 使用 FormData 时，浏览器会自动生成 multipart/form-data 和 boundary。
  const formData = new FormData() // 创建 multipart/form-data 请求体
  formData.append('file', file) // 后端 FastAPI 接口参数名是 file，因此这里也必须叫 file

  const response = await fetch(`${API_BASE_URL}/knowledge/upload/preview`, { // 请求后端上传预览接口
    method: 'POST', // 上传文件会创建/修改服务端资源，因此使用 POST
    body: formData, // 直接传 FormData，不经过 JSON.stringify
    signal, // 允许后续扩展取消上传
  })

  if (!response.ok) { // 上传失败时，把后端错误转成 Error
    const message = await readErrorMessage(response) // 读取 FastAPI 错误 detail
    throw new Error(message) // 抛给页面层显示
  }

  return response.json() as Promise<KnowledgeUploadPreviewResponse> // 成功时返回预览结果
}

export function confirmKnowledgeUpload(uploadId: string, documentType: string, splitStrategy: string) { // 确认预览并正式入库
  return request<KnowledgeUploadResponse>('/knowledge/upload/confirm', {
    method: 'POST',
    body: JSON.stringify({
      upload_id: uploadId,
      document_type: documentType,
      split_strategy: splitStrategy,
    }),
  })
}

export function deleteKnowledgeFile(documentId: string) { // 删除知识库文件
  return request<KnowledgeDeleteResponse>(`/knowledge/files/${encodeURIComponent(documentId)}`, {
    method: 'DELETE', // 删除文件用 DELETE
  })
}

export function reindexKnowledgeFile(documentId: string) { // 重新索引知识库文件
  return request<KnowledgeFileResponse>(`/knowledge/files/${encodeURIComponent(documentId)}/reindex`, {
    method: 'POST', // 重建索引会修改 Qdrant 和 SQLite 状态，因此使用 POST
  })
}

export function reindexAllKnowledgeFiles() { // 清空 Qdrant collection 并重新索引全部知识库文件
  return request<KnowledgeBulkReindexResponse>('/knowledge/files/reindex-all', {
    method: 'POST', // 批量重建会清空并重建 Qdrant collection，因此使用 POST
  })
}

export function debugRetrieve(query: string) { // 调试 RAG 检索链路
  return request<DebugRetrieveResponse>('/debug/retrieve', {
    method: 'POST', // 调试接口需要提交 query，因此使用 POST
    body: JSON.stringify({ query }), // 后端 DebugRetrieveRequest 需要 query 字段
  })
}

export function sendChat(
  message: string,
  userId: string,
  conversationId: string | null,
  signal?: AbortSignal,
) { // 一次性聊天请求函数
  // 一次性聊天请求：
  // - 前端发送 message 和 user_id。
  // - 后端完整执行 Agent。
  // - 浏览器等到完整 JSON 返回后，才会拿到 response.answer。
  // - 适合“最终答案一次展示”的模式。
  return request<ChatResponse>('/chat', { // 请求后端 `/chat` 一次性接口
    method: 'POST', // 聊天请求携带 JSON 请求体，所以使用 POST
    body: JSON.stringify({ message, user_id: userId, conversation_id: conversationId }), // 携带会话 ID
    signal, // 允许外部通过 AbortController 取消请求
  })
}

export async function sendChatStream(
  message: string, // 用户输入的问题
  userId: string, // 当前会话用户 ID
  conversationId: string | null, // 当前会话 ID，首轮为空时后端会创建
  onChunk: (content: string) => void | Promise<void>, // 每收到一个回答片段时调用的回调
  onConversationId: (conversationId: string) => void, // 收到后端会话 ID 时调用
  signal?: AbortSignal, // 可选取消信号，用于停止生成
) { // 流式聊天请求函数
  // 流式聊天请求：
  // - 仍然使用 POST，因为请求体里需要传 JSON 参数。
  // - 返回值不是 JSON，而是 text/event-stream 文本流。
  // - fetch 拿到 response 后，通过 response.body.getReader() 一段段读取字节。
  // - 每解析出一个 SSE chunk，就调用 onChunk，把内容追加到当前助手消息。
  const response = await fetch(`${API_BASE_URL}/chat/stream`, { // 请求后端 `/chat/stream` 流式接口
    method: 'POST', // 流式接口同样需要提交 JSON 请求体
    headers: { // 设置流式请求头
      'Content-Type': 'application/json', // 请求体格式是 JSON
      // 明确告诉后端和可能存在的代理层：客户端期望接收 SSE。
      Accept: 'text/event-stream', // 期望后端返回 SSE 文本流
      // 本地开发或代理场景下，避免缓存层把流式响应攒完整再交给浏览器。
      'Cache-Control': 'no-cache', // 告诉中间层不要缓存当前请求
    },
    body: JSON.stringify({ message, user_id: userId, conversation_id: conversationId }), // 请求体带上 conversation_id
    // AbortSignal 用于“停止生成”按钮。
    // 前端调用 abort() 后，fetch 会中断读取，后续 catch 分支会显示“已停止生成”。
    signal, // 把取消信号交给 fetch
  })

  if (!response.ok || !response.body) { // 状态码异常，或者浏览器没有提供可读流
    // 流式接口如果连响应体都没有，说明请求还没进入正常 SSE 流程。
    const text = await response.text() // 读取错误内容
    throw new Error(text || `Request failed: ${response.status}`) // 抛给页面层显示
  }

  // reader 每次读取的是浏览器当前收到的一段二进制数据。
  // 这一段数据不一定刚好对应一个完整 SSE 事件：
  // - 可能半个事件被拆到两次 read()。
  // - 也可能多个事件合并在同一次 read()。
  const reader = response.body.getReader() // 从响应体里拿到流式 reader

  // SSE 是 UTF-8 文本协议，TextDecoder 负责把 Uint8Array 转成字符串。
  // `{ stream: true }` 能正确处理一个中文字符被拆到两个网络包里的情况。
  const decoder = new TextDecoder('utf-8') // 创建 UTF-8 解码器

  // buffer 保存“已经收到但还没有形成完整 SSE 事件”的残留文本。
  // 没有这个 buffer，遇到半个事件时 JSON.parse 就会失败。
  let buffer = '' // 保存尚未解析完成的 SSE 文本

  async function handleEvent(eventText: string) { // 处理一个完整 SSE 事件
    // 一个 SSE 事件可能包含多行，例如：
    //
    // event: chunk
    // data: {"content":"你好"}
    //
    // 这里只关心 data 行；event 行只用于表达事件类型，当前前端通过 data 内容判断即可。
    const dataText = eventText // 从完整 SSE 事件里提取 data 内容
      .split(/\r?\n/) // 按行切分，兼容 \n 和 \r\n
      .filter((line) => line.startsWith('data:')) // 只保留 data 行，忽略 event 行
      .map((line) => line.slice(5).trimStart()) // 去掉 `data:` 前缀和前导空格
      .join('\n') // 多个 data 行按 SSE 规范合并

    if (!dataText) return // 没有 data 的事件直接忽略

    // 后端约定 data 是 JSON：
    // - {"content": "..."} 表示回答片段。
    // - {"error": "..."} 表示生成失败。
    // - {"done": true} 表示结束；前端无需额外处理，reader 结束即可收尾。
    const data = JSON.parse(dataText) // 把 data 字符串解析成对象
    if (data.conversation_id) { // meta/done 事件会带回会话 ID
      onConversationId(data.conversation_id) // 保存到页面状态，后续请求继续携带
    }
    if (data.content) { // content 表示一个正常回答片段
      // 必须 await onChunk：
      // - App.vue 里的 onChunk 会更新 Vue 响应式消息内容。
      // - 随后会等待 nextTick 滚动到底部。
      // - 如果不 await，多个 chunk 可能在同一个任务里被快速处理，页面看起来更像一次性刷新。
      await onChunk(data.content) // 把回答片段交给 App.vue 追加到页面
    }
    if (data.error) { // error 表示后端生成过程中出错
      throw new Error(data.error) // 抛出错误，进入 App.vue 的 catch 分支
    }
  }

  while (true) { // 持续读取后端流，直到后端关闭响应
    const { value, done } = await reader.read() // 读取一段二进制数据
    if (done) break // done=true 表示后端流结束

    // 把本次收到的字节追加进 buffer。
    buffer += decoder.decode(value, { stream: true }) // 解码本次收到的字节并追加到 buffer

    // SSE 事件之间用空行分隔。
    // 这里兼容两种换行：
    // - \n\n：后端代码直接 yield 的格式。
    // - \r\n\r\n：某些代理或工具显示 HTTP 文本时可能出现的格式。
    const events = buffer.split(/\r?\n\r?\n/) // 按空行切分出完整 SSE 事件

    // split 后最后一段可能是不完整事件，不能立刻解析，先留到下一次 read()。
    buffer = events.pop() || '' // 最后一段可能不完整，继续留在 buffer

    for (const eventText of events) { // 遍历本次解析出的完整事件
      // 逐个处理完整事件，处理顺序与后端发送顺序一致。
      await handleEvent(eventText) // 按顺序处理事件
    }
  }

  // reader 结束后，decoder.decode() 不带参数可以刷新 TextDecoder 内部残留字节。
  buffer += decoder.decode() // 刷新 TextDecoder 内部可能残留的字节

  // 理论上标准 SSE 最后会有空行，buffer 应该为空。
  // 这里兜底处理最后一个没有空行结尾的事件，增强兼容性。
  if (buffer.trim()) { // 如果最后仍然残留了一个未处理事件
    await handleEvent(buffer) // 兜底处理最后事件
  }
}
