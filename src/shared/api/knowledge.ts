import { fetchWithAuth, readErrorMessage, request } from './http'
import type { KnowledgeBulkReindexResponse, KnowledgeDeleteResponse, KnowledgeFilePreviewResponse, KnowledgeFileResponse, KnowledgeUploadPreviewResponse, KnowledgeUploadRecommendResponse, KnowledgeUploadResponse } from './types'

export function reloadKnowledge() { // 触发后端重新加载知识库到 Qdrant
  return request<{ status: string; collection_name: string }>('/knowledge/reload', { // 返回简单状态对象
    method: 'POST', // 重载知识库会修改服务端状态，因此使用 POST
  })
}

export function listKnowledgeFiles(includeTraining = false) { // 获取知识库文件列表
  const params = new URLSearchParams()
  if (includeTraining) params.set('include_training', 'true')
  const query = params.toString()
  return request<KnowledgeFileResponse[]>(`/knowledge/files${query ? `?${query}` : ''}`) // GET /knowledge/files
}

export function previewKnowledgeDocument(documentId: string, maxChars = 30000) { // 预览已入库知识库文件
  const params = new URLSearchParams({ max_chars: String(maxChars) }) // 控制后端最多返回多少字符
  return request<KnowledgeFilePreviewResponse>(
    `/knowledge/files/${encodeURIComponent(documentId)}/preview?${params.toString()}`,
  ) // GET /knowledge/files/{document_id}/preview
}

export async function previewKnowledgeFile(file: File, signal?: AbortSignal) { // 上传文件并获取预解析结果
  // 文件上传不能手动设置 Content-Type: application/json。
  // 使用 FormData 时，浏览器会自动生成 multipart/form-data 和 boundary。
  const formData = new FormData() // 创建 multipart/form-data 请求体
  formData.append('file', file) // 后端 FastAPI 接口参数名是 file，因此这里也必须叫 file

  const response = await fetchWithAuth('/knowledge/upload/preview', { // 请求后端上传预览接口
    method: 'POST', // 上传文件会创建/修改服务端资源，因此使用 POST
    body: formData, // 直接传 FormData，不经过 JSON.stringify
    signal, // 允许后续扩展取消上传
  }, false)

  if (!response.ok) { // 上传失败时，把后端错误转成 Error
    const message = await readErrorMessage(response) // 读取 FastAPI 错误 detail
    throw new Error(message) // 抛给页面层显示
  }

  return response.json() as Promise<KnowledgeUploadPreviewResponse> // 成功时返回预览结果
}

export function recommendKnowledgeUpload(uploadId: string) { // 调用模型推荐上传文件切分方式
  return request<KnowledgeUploadRecommendResponse>('/knowledge/upload/recommend', {
    method: 'POST',
    body: JSON.stringify({ upload_id: uploadId }),
  })
}

export function confirmKnowledgeUpload(
  uploadId: string,
  documentType: string,
  splitStrategy: string,
  collectionName: string,
) { // 确认预览并正式入库
  return request<KnowledgeUploadResponse>('/knowledge/upload/confirm', {
    method: 'POST',
    body: JSON.stringify({
      upload_id: uploadId,
      document_type: documentType,
      split_strategy: splitStrategy,
      collection_name: collectionName,
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
    method: 'POST', // 重建索引会修改 Qdrant 和 MySQL 中的索引状态，因此使用 POST
  })
}

export function reindexAllKnowledgeFiles() { // 清空 Qdrant collection 并重新索引全部知识库文件
  return request<KnowledgeBulkReindexResponse>('/knowledge/files/reindex-all', {
    method: 'POST', // 批量重建会清空并重建 Qdrant collection，因此使用 POST
  })
}
