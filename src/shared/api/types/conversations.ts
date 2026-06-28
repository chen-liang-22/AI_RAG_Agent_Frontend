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
  first_token_ms?: number | null // 助手首字/首片耗时
  total_ms?: number | null // 助手完整回答耗时
  created_at: string // 创建时间
}

export interface ConversationDetailResponse { // `/conversations/{conversation_id}` 详情响应
  conversation: ConversationSummaryResponse // 会话摘要
  messages: ConversationMessageResponse[] // 全部消息
}

export interface ConversationDeleteResponse { // DELETE `/conversations/{conversation_id}` 响应
  status: string // 固定为 deleted
  conversation_id: string // 被删除的会话 ID
}
