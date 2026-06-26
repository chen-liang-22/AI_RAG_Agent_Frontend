import { request } from './http'
import type { DictionaryGroupPayload, DictionaryGroupResponse, DictionaryItemPayload, DictionaryItemResponse } from './types'

export function listDictionaries(dictionaryCode?: string) { // 查询系统字典表，支持按字典编码过滤
  const query = dictionaryCode ? `?dictionary_code=${encodeURIComponent(dictionaryCode)}` : ''
  return request<DictionaryGroupResponse[]>(`/dictionaries${query}`)
}

export function listTrainingProfileDictionaries() { // 查询销售训练画像字典，包含学员画像和客户画像
  return request<DictionaryGroupResponse[]>('/training/profile-dictionaries')
}

export function createDictionaryGroup(payload: DictionaryGroupPayload) { // 新增父级字典
  return request<DictionaryGroupResponse>('/dictionaries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateDictionaryGroup(dictionaryCode: string, payload: DictionaryGroupPayload) { // 修改父级字典
  return request<DictionaryGroupResponse>(`/dictionaries/${encodeURIComponent(dictionaryCode)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function createDictionaryItem(payload: DictionaryItemPayload) { // 新增字典项
  return request<DictionaryItemResponse>('/dictionaries/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateDictionaryItem(dictionaryItemId: string, payload: DictionaryItemPayload) { // 修改字典项
  return request<DictionaryItemResponse>(`/dictionaries/items/${encodeURIComponent(dictionaryItemId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function setDictionaryItemEnabled(dictionaryItemId: string, enabled: boolean) { // 启用或禁用字典项
  const params = new URLSearchParams({ enabled: String(enabled) })
  return request<DictionaryItemResponse>(
    `/dictionaries/items/${encodeURIComponent(dictionaryItemId)}/enabled?${params.toString()}`,
    { method: 'PATCH' },
  )
}

export function deleteDictionaryItem(dictionaryItemId: string) { // 删除字典项
  return request<{ status: string; dictionary_item_id: string }>(
    `/dictionaries/items/${encodeURIComponent(dictionaryItemId)}`,
    { method: 'DELETE' },
  )
}

export function deleteDictionaryGroup(dictionaryCode: string) { // 删除父级字典及其全部字典项
  return request<{ status: string; dictionary_code: string; deleted_count: number }>(
    `/dictionaries/${encodeURIComponent(dictionaryCode)}`,
    { method: 'DELETE' },
  )
}
