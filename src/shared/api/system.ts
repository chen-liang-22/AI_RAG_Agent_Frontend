import { request } from './http'
import type { HealthResponse } from './types'

export function fetchHealth() { // 获取后端和 Qdrant 健康状态
  return request<HealthResponse>('/health') // GET /health，返回 HealthResponse
}
