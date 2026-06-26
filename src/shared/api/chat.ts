import { buildRequestHeaders, fetchWithAuth, request } from './http'
import type { ChatResponse, ModelMode } from './types'

export function sendChat(
  message: string,
  userId: string,
  conversationId: string | null,
  modelMode: ModelMode,
  collectionName: string,
  signal?: AbortSignal,
) { // 一次性聊天请求函数
  // 一次性聊天请求：
  // - 前端发送 message 和 user_id。
  // - 后端完整执行 Agent。
  // - 浏览器等到完整 JSON 返回后，才会拿到 response.answer。
  // - 适合“最终答案一次展示”的模式。
  return request<ChatResponse>('/chat', { // 请求后端 `/chat` 一次性接口
    method: 'POST', // 聊天请求携带 JSON 请求体，所以使用 POST
    body: JSON.stringify({
      message,
      user_id: userId,
      conversation_id: conversationId,
      model_mode: modelMode,
      collection_name: collectionName,
    }), // 携带会话 ID 和当前 collection
    signal, // 允许外部通过 AbortController 取消请求
  })
}

export async function sendChatStream(
  message: string, // 用户输入的问题
  userId: string, // 当前会话用户 ID
  conversationId: string | null, // 当前会话 ID，首轮为空时后端会创建
  modelMode: ModelMode, // 当前回答模型档位
  collectionName: string, // 当前检索的 Qdrant collection
  onChunk: (content: string) => void | Promise<void>, // 每收到一个回答片段时调用的回调
  onConversationId: (conversationId: string) => void, // 收到后端会话 ID 时调用
  onMetrics?: (metrics: { first_token_ms?: number | null; total_ms?: number | null }) => void, // 收到耗时指标时调用
  signal?: AbortSignal, // 可选取消信号，用于停止生成
) { // 流式聊天请求函数
  // 流式聊天请求：
  // - 仍然使用 POST，因为请求体里需要传 JSON 参数。
  // - 返回值不是 JSON，而是 text/event-stream 文本流。
  // - fetch 拿到 response 后，通过 response.body.getReader() 一段段读取字节。
  // - 每解析出一个 SSE chunk，就调用 onChunk，把内容追加到当前助手消息。
  const response = await fetchWithAuth('/chat/stream', { // 请求后端 `/chat/stream` 流式接口
    method: 'POST', // 流式接口同样需要提交 JSON 请求体
    headers: buildRequestHeaders({ // 设置流式请求头，并自动携带登录 token
      // 明确告诉后端和可能存在的代理层：客户端期望接收 SSE。
      Accept: 'text/event-stream', // 期望后端返回 SSE 文本流
      // 本地开发或代理场景下，避免缓存层把流式响应攒完整再交给浏览器。
      'Cache-Control': 'no-cache', // 告诉中间层不要缓存当前请求
    }),
    body: JSON.stringify({
      message,
      user_id: userId,
      conversation_id: conversationId,
      model_mode: modelMode,
      collection_name: collectionName,
    }), // 请求体带上 conversation_id 和当前 collection
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
    if (data.first_token_ms !== undefined || data.total_ms !== undefined) { // metric/done 事件会带耗时
      onMetrics?.({
        first_token_ms: data.first_token_ms ?? null,
        total_ms: data.total_ms ?? null,
      }) // 把耗时交给 App.vue 展示
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
