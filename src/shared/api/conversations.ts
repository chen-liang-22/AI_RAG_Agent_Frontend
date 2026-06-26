import { request } from './http'
import type { ConversationDeleteResponse, ConversationDetailResponse, ConversationListResponse } from './types'

export function listConversations(page = 1, pageSize = 10, userId?: string, keyword?: string) { // 分页查询聊天记录
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (userId) {
    params.set('user_id', userId)
  }
  if (keyword?.trim()) {
    params.set('keyword', keyword.trim())
  }
  return request<ConversationListResponse>(`/conversations?${params.toString()}`)
}

export function getConversationDetail(conversationId: string) { // 查询单个聊天记录详情
  return request<ConversationDetailResponse>(`/conversations/${encodeURIComponent(conversationId)}`)
}

export function deleteConversation(conversationId: string) { // 删除单个聊天记录
  return request<ConversationDeleteResponse>(`/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  })
}
