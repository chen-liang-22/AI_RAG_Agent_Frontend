import { request } from './http'
import type { ExamAnswerResponse, ExamHistoryListResponse, ExamSectionsResponse, ExamSessionDetailResponse, ExamStartPayload, ExamStartResponse } from './types'

export function listExamSections(collectionName?: string | null, documentId?: string | null) { // 查询考试题源目录
  const params = new URLSearchParams()
  if (collectionName) params.set('collection_name', collectionName)
  if (documentId) params.set('document_id', documentId)
  const query = params.toString()
  return request<ExamSectionsResponse>(`/exam/sections${query ? `?${query}` : ''}`)
}

export function startExamSession(payload: ExamStartPayload) { // 开始一场对话式考试
  return request<ExamStartResponse>('/exam/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function answerExamSession(sessionId: string, answer: string | string[]) { // 提交当前轮答案
  return request<ExamAnswerResponse>(`/exam/sessions/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  })
}

export function listExamSessions(page = 1, pageSize = 10, userId?: string, keyword?: string) { // 分页查询考试历史
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (userId) params.set('user_id', userId)
  if (keyword?.trim()) params.set('keyword', keyword.trim())
  return request<ExamHistoryListResponse>(`/exam/sessions?${params.toString()}`)
}

export function getExamSessionDetail(sessionId: string) { // 查询考试详情
  return request<ExamSessionDetailResponse>(`/exam/sessions/${encodeURIComponent(sessionId)}`)
}
