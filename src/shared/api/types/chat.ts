export interface ChatResponse { // `/chat` 一次性接口返回的数据结构
  // 一次性聊天接口返回的完整回答。
  // 流式接口不会使用这个结构，而是不断收到 SSE chunk 事件。
  answer: string
  conversation_id: string
  first_token_ms?: number | null // 首字/首片耗时；一次性接口通常等于 total_ms
  total_ms?: number | null // 本次聊天总耗时
}

export type ModelMode = string
