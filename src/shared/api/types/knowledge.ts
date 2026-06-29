export interface KnowledgeFileResponse { // `/knowledge/files` 返回的单个知识库文件结构
  document_id: string // 文件唯一 ID，删除和重建索引都靠它定位
  filename: string // 原始文件名
  file_path: string // 后端保存路径
  file_type: string // 文件类型，例如 txt/pdf
  file_md5: string // 文件内容 MD5，用于后端判断重复上传
  file_size: number // 文件大小，单位字节
  status: string // uploaded/indexing/indexed/failed/deleted
  version: number // 文件索引版本，reindex 后递增
  chunk_count: number // 写入 Qdrant 的知识单元数量
  collection_name: string // 文件写入的 Qdrant collection
  document_type: string // 文档结构类型：qa/numbered/text
  split_strategy: string // 当前文件使用的切分策略
  created_at: string // 创建时间
  updated_at: string // 更新时间
  error_message?: string | null // 入库失败时的错误信息
}

export interface KnowledgeUploadResponse { // `/knowledge/upload/confirm` 确认入库后的响应结构
  status: string // 知识库操作结果编码，具体值来自 knowledge_result_status 字典
  message: string // 后端返回的简短说明
  document: KnowledgeFileResponse // 对应的文件记录
  task_id?: string | null // 异步入库任务 ID，重复文件时为空
  task_status?: string | null // 异步任务状态：queued/running/succeeded/failed
  current_step?: string | null // 当前处理步骤
  progress?: number | null // 入库进度，0 到 100
}

export interface KnowledgeUploadPreviewResponse { // `/knowledge/upload/preview` 上传预览响应结构
  upload_id: string // 临时上传 ID，确认入库时使用
  filename: string // 文件名
  file_type: string // 文件类型
  file_size: number // 文件大小
  file_md5: string // 文件 MD5
  duplicate: boolean // 是否重复
  duplicate_document?: KnowledgeFileResponse | null // 重复时已有文件记录
  detected_type: string // 系统识别的文档结构类型：qa/numbered/text
  split_strategy: string // 系统建议的切分策略
  confidence: number // 识别置信度
  reasons: string[] // 识别原因
  llm_used: boolean // 是否使用 LLM 兜底
  sample_text: string // 预览文本
}

export interface KnowledgeUploadRecommendResponse { // `/knowledge/upload/recommend` 模型推荐响应结构
  document_type: string // 模型推荐的文档结构类型：qa/numbered/text
  split_strategy: string // 模型推荐的切分策略
  confidence: number // 模型推荐置信度
  reasons: string[] // 推荐原因
  sample_chars: number // 实际发送给模型的样本字符数
  model_name: string // 本次推荐使用的模型
}

export interface KnowledgeFilePreviewResponse { // `/knowledge/files/{document_id}/preview` 已入库文件预览结构
  document: KnowledgeFileResponse // 被预览的知识库文件元数据
  preview_type: string // text 表示展示 content，file_url 表示在弹窗内嵌 MinIO HTTP 地址
  content: string // TXT/DOCX/PDF 等文本预览内容
  truncated: boolean // 内容是否因 max_chars 被截断
  page_count?: number | null // PDF 页数；TXT 文件为空
  file_url?: string | null // MinIO HTTP 文件地址，前端用于弹窗内嵌或兜底打开
  charset?: string | null // 文本预览采用的字符集或解析器标识
}

export interface KnowledgeDeleteResponse { // `/knowledge/files/{document_id}` DELETE 响应结构
  status: string // 固定为 deleted
  document_id: string // 被删除的文件 ID
}

export interface KnowledgeReindexResult { // 全部重建索引时单个文件的结果
  document_id: string // 文件 ID
  filename: string // 文件名
  status: string // indexed 或 failed
  message?: string | null // 成功说明或失败原因
}

export interface KnowledgeBulkReindexResponse { // `/knowledge/files/reindex-all` 响应结构
  status: string // ok 或 partial_failed
  total: number // 总文件数
  succeeded: number // 成功数量
  failed: number // 失败数量
  results: KnowledgeReindexResult[] // 每个文件的重建结果
}
