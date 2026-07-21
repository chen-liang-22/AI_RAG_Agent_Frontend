import { request } from './http'
import type {
  PromptCreatePayload,
  PromptDeleteResponse,
  PromptListResponse,
  PromptResponse,
  PromptUpdatePayload,
} from './types'

export function listPrompts(params: {
  page: number
  pageSize: number
  keyword?: string
  domain?: string
  enabled?: boolean
}) { // 分页查询提示词
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  })
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.domain) query.set('domain', params.domain)
  if (params.enabled !== undefined) query.set('enabled', String(params.enabled))
  return request<PromptListResponse>(`/system/prompts?${query.toString()}`)
}

export function getPrompt(promptKey: string) { // 按提示词键查询详情
  return request<PromptResponse>(`/system/prompts/${encodeURIComponent(promptKey)}`)
}

export function createPrompt(payload: PromptCreatePayload) { // 新增提示词
  return request<PromptResponse>('/system/prompts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updatePrompt(promptKey: string, payload: PromptUpdatePayload) { // 全量修改提示词
  return request<PromptResponse>(`/system/prompts/${encodeURIComponent(promptKey)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deletePrompt(promptKey: string) { // 删除提示词
  return request<PromptDeleteResponse>(`/system/prompts/${encodeURIComponent(promptKey)}`, {
    method: 'DELETE',
  })
}
