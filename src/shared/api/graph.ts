import { request } from './http'
import type { GraphDocumentListResponse, GraphDocumentResponse, GraphHealthResponse, GraphOverviewResponse } from './types'

export function fetchGraphHealth() { // 查询 Neo4j 是否可连接
  return request<GraphHealthResponse>('/graph/health')
}

export function initGraphSchema() { // 初始化 Neo4j 约束和索引
  return request<GraphHealthResponse>('/graph/init', {
    method: 'POST',
  })
}

export function fetchGraphOverview() { // 查询知识图谱节点、关系和标签分布
  return request<GraphOverviewResponse>('/graph/overview')
}

export function fetchGraphDocuments(keyword = '', limit = 20) { // 按文件名模糊查询已进入图谱的文件
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  params.set('limit', String(limit))
  return request<GraphDocumentListResponse>(`/graph/documents?${params.toString()}`)
}

export function fetchGraphDocument(documentId: string) { // 按文件编号查询图谱详情
  return request<GraphDocumentResponse>(`/graph/documents/${encodeURIComponent(documentId)}`)
}

export function rebuildGraphDocument(documentId: string) { // 从 Qdrant 已有切片重建单个文件的图谱
  return request<GraphDocumentResponse>(`/graph/rebuild/documents/${encodeURIComponent(documentId)}`, {
    method: 'POST',
  })
}
