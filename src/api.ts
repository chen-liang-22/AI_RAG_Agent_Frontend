export interface HealthResponse { // `/health` 接口返回的数据结构
  status: string // 后端整体状态，例如 ok/degraded
  qdrant: string // Qdrant 状态，例如 ok/unavailable
  collection_name: string // 当前使用的 Qdrant collection 名称
  collections: string[] // Qdrant 中已有的 collection 列表
  collection_points: Record<string, number> // 每个 Qdrant collection 的真实向量点数量
}

export interface ChatResponse { // `/chat` 一次性接口返回的数据结构
  // 一次性聊天接口返回的完整回答。
  // 流式接口不会使用这个结构，而是不断收到 SSE chunk 事件。
  answer: string
  conversation_id: string
  first_token_ms?: number | null // 首字/首片耗时；一次性接口通常等于 total_ms
  total_ms?: number | null // 本次聊天总耗时
}

export type ModelMode = string

export interface DictionaryItemResponse { // 后端字典项，children 支持多层级展示
  dictionary_item_id: string // 字典项唯一 ID
  dictionary_code: string // 字典编码
  dictionary_name: string // 字典名称
  item_code: string // 字典项编码
  item_name: string // 字典项名称
  parent_item_id?: string | null // 父级字典项 ID
  item_level: number // 字典项层级
  sort_order: number // 同级排序号
  enabled: boolean // 是否启用
  description?: string | null // 字典项说明
  metadata: Record<string, unknown> // 前端展示或业务扩展元数据
  children: DictionaryItemResponse[] // 子级字典项
}

export interface DictionaryGroupResponse { // 后端按 dictionary_code 分组后的字典
  dictionary_code: string // 字典编码
  dictionary_name: string // 字典名称
  items: DictionaryItemResponse[] // 树形字典项
}

export interface DictionaryGroupPayload { // 新增或修改父级字典的请求结构
  dictionary_code?: string // 新增时必填：父级字典编码
  dictionary_name: string // 父级字典名称
}

export interface DictionaryItemPayload { // 新增或修改字典项的请求结构
  dictionary_code?: string // 新增时必填：字典编码
  dictionary_name?: string // 字典名称
  item_code?: string // 字典项编码
  item_name?: string // 字典项名称
  parent_item_id?: string | null // 父级字典项 ID
  sort_order?: number // 排序号
  enabled?: boolean // 是否启用
  description?: string | null // 说明
  metadata?: Record<string, unknown> // 扩展元数据
}

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
  preview_type: string // text/pdf_text/unsupported，表示后端采用的预览方式
  content: string // 预览文本内容
  truncated: boolean // 是否因为内容过长被后端截断
  page_count?: number | null // PDF 页数；TXT 文件为空
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

export type ExamQuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'

export interface ExamSectionResponse { // 可用于考试的目录路径
  section_path: string // 目录路径
  question_count: number // 该目录下题目数量
}

export interface ExamSectionsResponse { // `/exam/sections` 响应结构
  collection_name: string // 向量库名称
  document_id?: string | null // 文件编号
  sections: ExamSectionResponse[] // 目录列表
}

export interface ExamStartPayload { // `/exam/sessions` 开始考试请求结构
  title: string // 本场测评名称
  collection_name?: string | null // 题源所在向量库
  document_id?: string | null // 题源文件
  section_path?: string | null // 题源目录
  user_id?: string | null // 用户编号
  round_count: number // 考试轮数
  question_types: ExamQuestionType[] // 随机题型范围
  model_mode?: string | null // 主观题分析模型档位
  seed?: number | null // 随机种子
}

export interface ExamQuestionSource { // 考试题目的知识来源信息
  document_id?: string | null // 来源文件编号
  filename?: string | null // 来源文件名
  section_path?: string | null // 来源章节路径
  source_page?: number | null // 来源页码
}

export interface ExamConversationQuestion { // 对话式考试中的当前题目
  exam_question_id: string // 本场考试内的题目编号
  round_no: number // 当前轮次
  question_type: ExamQuestionType // 题型
  prompt: string // 题目文本
  options: string[] // 选项
  max_score: number // 本题满分
  source: ExamQuestionSource // 来源信息
}

export interface ExamSessionSummary { // 考试会话摘要
  session_id: string // 考试会话编号
  user_id?: string | null // 用户编号
  title: string // 会话标题
  collection_name: string // 向量库名称
  document_id?: string | null // 文件编号
  filename?: string | null // 文件名
  section_path?: string | null // 目录路径
  round_count: number // 总轮数
  answered_count: number // 已答题数
  total_score: number // 当前总分
  max_score: number // 满分
  status: string // active/completed
  current_round: number // 当前轮次
  created_at: string // 创建时间
  updated_at: string // 更新时间
  completed_at?: string | null // 完成时间
}

export interface ExamStartResponse { // 开始考试响应结构
  session: ExamSessionSummary // 考试会话
  current_question: ExamConversationQuestion // 第一题
}

export interface ExamAnswerAnalysis { // 单题作答分析
  is_correct: boolean // 是否正确
  score: number // 本题得分
  max_score: number // 本题满分
  correct_answer: unknown // 正确答案
  reference_answer: string // 参考答案
  hit_points: string[] // 命中点
  missing_points: string[] // 遗漏点
  wrong_points: string[] // 错误点
  comment: string // 点评
}

export interface ExamAnswerResponse { // 提交答案响应结构
  session: ExamSessionSummary // 更新后的考试会话
  answered_question: ExamConversationQuestion // 已作答题目
  analysis: ExamAnswerAnalysis // 本题分析
  next_question?: ExamConversationQuestion | null // 下一题
}

export interface ExamHistoryListResponse { // 考试历史分页响应
  items: ExamSessionSummary[] // 当前页考试记录
  total: number // 总数
  page: number // 当前页
  page_size: number // 每页数量
}

export interface ExamQuestionRecord { // 考试详情单题记录
  question: ExamConversationQuestion // 题目
  user_answer?: string | null // 用户答案
  analysis?: ExamAnswerAnalysis | null // 分析
  answered_at?: string | null // 作答时间
}

export interface ExamSessionDetailResponse { // 考试详情响应
  session: ExamSessionSummary // 会话摘要
  questions: ExamQuestionRecord[] // 全部题目
}

export type TrainingResponseMode = 'stream' | 'blocking'

export interface TrainingKnowledgeUploadPayload { // 销售训练知识上传请求
  file: File // LMS 训练案例文件
  sourceType?: string // 知识来源类型，一期默认 lms_case
  modelMode?: string | null // LLM 兜底切分使用的模型档位，默认 high
  createdBy?: string // 上传人
}

export interface TrainingKnowledgeUploadResponse { // 销售训练知识入库结果
  batch_id: string
  status: string
  chunk_count: number
  point_count: number
  source_file?: string | null
  duplicate_of?: string | null
  quality_report: Record<string, unknown>
  failed_chunks: string[]
}

export interface TrainingKnowledgeBatchResponse { // 训练资料上传批次
  batch_id: string
  source_type: string
  source_file: string
  file_path?: string | null
  file_md5?: string | null
  version_group_id?: string | null
  version_no: number
  previous_batch_id?: string | null
  is_current: boolean
  profile_type?: string | null
  task_type?: string | null
  industry?: string | null
  difficulty?: string | null
  visibility_default?: string | null
  status: string
  chunk_count: number
  point_count: number
  error_message?: string | null
  quality_report: Record<string, unknown>
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface TrainingKnowledgeBatchListResponse { // 训练资料批次分页
  items: TrainingKnowledgeBatchResponse[]
  total: number
  page: number
  page_size: number
}

export interface TrainingKnowledgeChunkResponse { // 训练知识切片
  chunk_id: string
  batch_id: string
  case_part: string
  visibility: string
  chunk_text: string
  metadata: Record<string, unknown>
}

export interface TrainingKnowledgeChunkListResponse { // 训练知识切片列表
  batch_id: string
  chunks: TrainingKnowledgeChunkResponse[]
}

export interface TrainingKnowledgePreviewResponse { // 训练资料原文件预览
  batch: TrainingKnowledgeBatchResponse
  preview_type: string
  content: string
  truncated: boolean
}

export interface TrainingKnowledgeDeleteResponse { // 训练资料删除结果
  status: string
  batch_id: string
}

export interface TrainingKnowledgePublishResponse { // 训练资料确认发布结果
  batch_id: string
  status: string
  chunk_count: number
  point_count: number
  quality_report: Record<string, unknown>
}

export interface TrainingKnowledgeRollbackResponse { // 训练资料版本回滚结果
  batch_id: string
  status: string
  version_group_id: string
  version_no: number
  chunk_count: number
  point_count: number
  quality_report: Record<string, unknown>
}

export interface TrainingKnowledgeReparseResponse { // 训练资料重新切分结果
  batch_id: string
  status: string
  chunk_count: number
  point_count: number
  source_file?: string | null
  quality_report: Record<string, unknown>
}

export interface TrainingKnowledgeVersionListResponse { // 训练资料版本链
  version_group_id: string
  items: TrainingKnowledgeBatchResponse[]
}

export interface TrainingTraineeProfilePayload { // 学员画像输入
  trainee_id: string
  trainee_name: string
  position_role: string
  experience_level: string
  task_goal: string
  weakness_tags: string[]
  student_portrait_other?: string
}

export interface TrainingRoleGeneratePayload { // 生成 AI 客户角色请求
  plan_id?: string | null
  trainee: TrainingTraineeProfilePayload
  profile_type: string
  selected_fields: Record<string, unknown>
  scenario_description: string
  extra_details: string
  model_mode?: string | null
}

export interface TrainingScenarioPolishPayload { // AI 润色训练场景请求
  profile_type: string
  selected_fields: Record<string, unknown>
  scenario_description: string
  extra_details?: string
  model_mode?: string | null
}

export interface TrainingScenarioPolishResponse { // AI 润色训练场景结果
  polished_scenario: string
  original_scenario: string
}

export interface TrainingSupplementQuestionOption { // 生成角色前补充问答选项
  option_code: string
  option_text: string
}

export interface TrainingSupplementQuestion { // 生成角色前补充问答题
  question_id: string
  question_no: number
  question: string
  options: TrainingSupplementQuestionOption[]
  allow_other: boolean
  dimension: string
}

export interface TrainingSupplementQuestionGenerateResponse { // 补充问答题生成结果
  questions: TrainingSupplementQuestion[]
}

export interface TrainingRoleGenerateResponse { // AI 客户角色生成结果
  profile_id: string
  visible_profile: Record<string, unknown>
  hidden_profile: Record<string, unknown>
  role_profile: Record<string, unknown>
  role_confirm_card: Record<string, unknown>
  hidden_summary: string
  retrieved_cases: Record<string, unknown>[]
  knowledge_facts: string[]
}

export interface TrainingGoalStage { // 开放式训练目标阶段
  stage_no: number
  stage_name: string
  core_goal: string
  success_conditions: string[]
  failure_conditions: string[]
}

export interface TrainingGoalSettingResponse { // 训练目标设置
  setting_id: string
  profile_id: string
  training_mode: string
  training_purpose: string
  round_limit: number
  stages: TrainingGoalStage[]
  scoring_rules: Record<string, unknown>
  status: string
}

export interface TrainingPlanCreatePayload { // 创建销售训练方案
  plan_name: string
  trainee: TrainingTraineeProfilePayload
  profile_type: string
  selected_fields: Record<string, unknown>
  scenario_description: string
  extra_details: string
  model_mode?: string | null
}

export interface TrainingPlanUpdatePayload { // 修改销售训练方案
  plan_name?: string
  trainee?: TrainingTraineeProfilePayload
  profile_type?: string
  selected_fields?: Record<string, unknown>
  scenario_description?: string
  extra_details?: string
  model_mode?: string | null
  role_confirm_card?: Record<string, unknown>
  visible_profile?: Record<string, unknown>
  hidden_profile?: Record<string, unknown>
  role_profile?: Record<string, unknown>
  training_purpose?: string
  round_limit?: number
  stages?: TrainingGoalStage[]
  scoring_rules?: Record<string, unknown>
}

export interface TrainingPlanSummaryResponse { // 销售训练方案列表项
  plan_id: string
  plan_name: string
  trainee_id: string
  trainee_name: string
  profile_type: string
  model_mode?: string | null
  role_status: string
  goal_status: string
  score_status: string
  active_profile_id?: string | null
  active_setting_id?: string | null
  created_at: string
  updated_at: string
}

export interface TrainingPlanListResponse { // 销售训练方案分页
  items: TrainingPlanSummaryResponse[]
  total: number
  page: number
  page_size: number
}

export interface TrainingPlanDetailResponse { // 销售训练方案详情
  plan: TrainingPlanSummaryResponse
  trainee: Record<string, unknown>
  selected_fields: Record<string, unknown>
  scenario_description: string
  extra_details: string
  visible_profile: Record<string, unknown>
  hidden_profile: Record<string, unknown>
  role_profile: Record<string, unknown>
  role_confirm_card: Record<string, unknown>
  retrieved_cases: Record<string, unknown>[]
  goal_setting?: TrainingGoalSettingResponse | null
}

export interface TrainingSessionStartPayload { // 开始训练会话请求
  profile_id: string
  setting_id: string
  trainee_id: string
  response_mode: TrainingResponseMode
  model_mode?: string | null
}

export interface TrainingSessionResponse { // 训练会话
  session_id: string
  profile_id: string
  setting_id: string
  trainee_id: string
  training_mode: string
  response_mode: TrainingResponseMode
  current_stage_no: number
  status: string
  round_limit: number
  opening_message?: string | null
}

export interface TrainingTurnPayload { // 提交学员回复请求
  message: string
  response_mode: TrainingResponseMode
  model_mode?: string | null
}

export interface TrainingTurnResponse { // AI 客户本轮回复
  customer_reply: string
  current_stage_no: number
  stage_status: string
  session_status: string
  retrieved_chunk_ids: string[]
  coach_analysis: Record<string, unknown>
  response_seconds?: number | null
}

export interface TrainingScoreResponse { // 训练评分报告
  score_id: string
  session_id: string
  total_score: number
  level: string
  is_passed: boolean
  general_score: number
  stage_score: number
  penalty_score: number
  report: Record<string, unknown>
}

export interface TrainingSessionSummaryResponse { // 训练历史摘要
  session_id: string
  trainee_id: string
  training_mode: string
  response_mode: TrainingResponseMode
  status: string
  round_limit: number
  answered_count: number
  total_score?: number | null
  level?: string | null
  started_at: string
  ended_at?: string | null
  updated_at: string
}

export interface TrainingSessionListResponse { // 训练历史分页
  items: TrainingSessionSummaryResponse[]
  total: number
  page: number
  page_size: number
}

export interface TrainingTurnRecordResponse { // 训练复盘轮次
  turn_id: string
  session_id: string
  role: string
  content: string
  round_no: number
  stage_no: number
  response_mode?: string | null
  response_seconds?: number | null
  retrieved_chunk_ids: string[]
  stage_decision: Record<string, unknown>
  coach_analysis: Record<string, unknown>
  created_at: string
}

export interface TrainingSessionDetailResponse { // 训练复盘详情
  session: TrainingSessionSummaryResponse
  turns: TrainingTurnRecordResponse[]
  visible_profile: Record<string, unknown>
  hidden_profile: Record<string, unknown>
  role_profile: Record<string, unknown>
  role_confirm_card: Record<string, unknown>
  goal_setting: Record<string, unknown>
  knowledge_facts: string[]
  score?: TrainingScoreResponse | null
}

export interface TrainingStreamHandlers { // 训练 SSE 事件回调
  onRetrieval?: (payload: Record<string, unknown>) => void | Promise<void>
  onDelta?: (content: string) => void | Promise<void>
  onStageDecision?: (payload: Record<string, unknown>) => void | Promise<void>
  onDone?: (payload: TrainingTurnResponse) => void | Promise<void>
}

// API_BASE_URL 有两个典型取值：
// - 本地开发：通过 .env.development 配成 http://127.0.0.1:8000，绕过 Vite 代理，减少流式缓冲干扰。
// - Docker/Nginx 部署：使用默认 /api，由 Nginx 把 /api 转发给后端 api 容器。
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function readErrorMessage(response: Response) { // 把后端错误响应转换成更适合页面展示的文字
  const text = await response.text() // 先读取原始错误文本

  if (!text) { // 没有响应体时，用状态码兜底
    return `Request failed: ${response.status}` // 返回通用错误
  }

  try {
    const data = JSON.parse(text) // FastAPI 错误通常是 JSON，例如 {"detail":"..."}
    if (typeof data.detail === 'string') { // detail 是字符串时直接展示
      return data.detail // 返回后端 detail
    }
    if (data.detail) { // detail 是数组或对象时序列化展示
      return JSON.stringify(data.detail) // 返回结构化 detail
    }
  } catch {
    // 如果不是 JSON，就直接使用原始文本。
  }

  return text // 返回原始错误内容
}

async function request<T>(path: string, options?: RequestInit): Promise<T> { // 通用 JSON 请求函数，T 表示返回数据类型
  // 普通 JSON 请求封装。
  // `/health`、`/knowledge/reload`、`/chat` 都属于“请求完成后一次性解析 JSON”的接口。
  // 注意：这个函数会调用 response.json()，因此不能用于 `/chat/stream` 这种持续文本流接口。
  const response = await fetch(`${API_BASE_URL}${path}`, { // 发起 HTTP 请求，最终地址 = API_BASE_URL + path
    headers: { // 设置请求头
      'Content-Type': 'application/json', // 告诉后端请求体是 JSON
      ...options?.headers, // 合并调用方传入的额外请求头，调用方可以覆盖或扩展
    },
    ...options, // 合并 method、body、signal 等请求配置
  })

  if (!response.ok) { // HTTP 状态码不是 2xx 时进入错误处理
    // 后端返回非 2xx 时，优先读取原始文本，方便把 FastAPI 的错误信息展示出来。
    const message = await readErrorMessage(response) // 读取并格式化后端错误
    throw new Error(message) // 抛出错误给页面层显示
  }

  // 一次性接口在这里等待完整响应体，然后整体反序列化成 JSON。
  return response.json() as Promise<T> // 把完整响应体解析成 JSON，并按 T 类型返回
}

export function fetchHealth() { // 获取后端和 Qdrant 健康状态
  return request<HealthResponse>('/health') // GET /health，返回 HealthResponse
}

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

export function reloadKnowledge() { // 触发后端重新加载知识库到 Qdrant
  return request<{ status: string; collection_name: string }>('/knowledge/reload', { // 返回简单状态对象
    method: 'POST', // 重载知识库会修改服务端状态，因此使用 POST
  })
}

export function listKnowledgeFiles() { // 获取知识库文件列表
  return request<KnowledgeFileResponse[]>('/knowledge/files') // GET /knowledge/files
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

  const response = await fetch(`${API_BASE_URL}/knowledge/upload/preview`, { // 请求后端上传预览接口
    method: 'POST', // 上传文件会创建/修改服务端资源，因此使用 POST
    body: formData, // 直接传 FormData，不经过 JSON.stringify
    signal, // 允许后续扩展取消上传
  })

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
    method: 'POST', // 重建索引会修改 Qdrant 和 SQLite 状态，因此使用 POST
  })
}

export function reindexAllKnowledgeFiles() { // 清空 Qdrant collection 并重新索引全部知识库文件
  return request<KnowledgeBulkReindexResponse>('/knowledge/files/reindex-all', {
    method: 'POST', // 批量重建会清空并重建 Qdrant collection，因此使用 POST
  })
}

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

export async function uploadTrainingKnowledge(payload: TrainingKnowledgeUploadPayload) { // 上传销售训练知识并写入临时向量库预览
  // 文件上传必须使用 FormData，让浏览器自动生成 multipart boundary。
  const formData = new FormData()
  // file 对应后端 FastAPI 的 file: UploadFile = File(...)。
  formData.append('file', payload.file)
  // source_type 决定后端使用哪一种 KnowledgeIngestStrategy；一期默认 lms_case。
  formData.append('source_type', payload.sourceType || 'lms_case')
  // model_mode 只影响资料切分阶段的 LLM 兜底；临时向量库 embedding 使用后端统一配置。
  formData.append('model_mode', payload.modelMode || 'high')

  // 上传人只用于审计；当前没有用户体系时可以不传。
  if (payload.createdBy) formData.append('created_by', payload.createdBy)

  // 注意这里不用通用 request()，因为通用 request() 默认发 JSON；
  // 文件上传必须让 fetch 直接携带 FormData。
  const response = await fetch(`${API_BASE_URL}/training/knowledge/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  return response.json() as Promise<TrainingKnowledgeUploadResponse>
}

export function listTrainingKnowledgeChunks(batchId: string) { // 从临时库或正式库查看某次训练知识上传拆出的切片
  return request<TrainingKnowledgeChunkListResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}/chunks`)
}

export function previewTrainingKnowledgeBatch(batchId: string, maxChars = 30000) { // 预览上传保存的训练资料原文件
  const params = new URLSearchParams({
    max_chars: String(maxChars),
  })
  return request<TrainingKnowledgePreviewResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}/preview?${params.toString()}`)
}

export function deleteTrainingKnowledgeBatch(batchId: string) { // 删除训练资料批次和对应向量点
  return request<TrainingKnowledgeDeleteResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}`, {
    method: 'DELETE',
  })
}

export function publishTrainingKnowledgeBatch(batchId: string) { // 确认发布训练资料，把临时向量复制到正式训练向量库
  return request<TrainingKnowledgePublishResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}/publish`, {
    method: 'POST',
  })
}

export function rollbackTrainingKnowledgeBatch(batchId: string) { // 回滚训练资料到指定历史版本
  return request<TrainingKnowledgeRollbackResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}/rollback`, {
    method: 'POST',
  })
}

export function reparseTrainingKnowledgeBatch(batchId: string, useLlmFallback = true, modelMode: string | null = 'high') { // 重新切分未发布训练资料
  const params = new URLSearchParams({
    use_llm_fallback: String(useLlmFallback),
    model_mode: modelMode || 'high',
  })
  return request<TrainingKnowledgeReparseResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}/reparse?${params.toString()}`, {
    method: 'POST',
  })
}

export function listTrainingKnowledgeBatchVersions(batchId: string) { // 查询训练资料版本链
  return request<TrainingKnowledgeVersionListResponse>(`/training/knowledge/batches/${encodeURIComponent(batchId)}/versions`)
}

export function listTrainingKnowledgeBatches(page = 1, pageSize = 10) { // 查询训练资料上传历史
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  return request<TrainingKnowledgeBatchListResponse>(`/training/knowledge/batches?${params.toString()}`)
}

export function createTrainingPlan(payload: TrainingPlanCreatePayload) { // 创建训练方案，名称允许重复，后端用 plan_id 区分
  return request<TrainingPlanDetailResponse>('/training/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listTrainingPlans(page = 1, pageSize = 8, keyword?: string) { // 查询训练方案列表
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (keyword?.trim()) params.set('keyword', keyword.trim())
  return request<TrainingPlanListResponse>(`/training/plans?${params.toString()}`)
}

export function getTrainingPlanDetail(planId: string) { // 查看训练方案每一步详情
  return request<TrainingPlanDetailResponse>(`/training/plans/${encodeURIComponent(planId)}`)
}

export function updateTrainingPlan(planId: string, payload: TrainingPlanUpdatePayload) { // 修改训练方案某一步
  return request<TrainingPlanDetailResponse>(`/training/plans/${encodeURIComponent(planId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function generateTrainingRole(payload: TrainingRoleGeneratePayload) { // 根据学员画像和场景生成 AI 客户
  return request<TrainingRoleGenerateResponse>('/training/profiles/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function polishTrainingScenario(payload: TrainingScenarioPolishPayload) { // 根据客户画像用 AI 润色训练场景
  return request<TrainingScenarioPolishResponse>('/training/profiles/scenario/polish', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function generateTrainingSupplementQuestions(payload: TrainingRoleGeneratePayload) { // 生成 AI 客户前的补充问答题
  return request<TrainingSupplementQuestionGenerateResponse>('/training/profiles/supplement-questions/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function generateTrainingGoalSetting(profileId: string, traineeId: string, modelMode?: string | null, planId?: string | null) { // 生成开放式训练目标和动态轮数
  return request<TrainingGoalSettingResponse>(`/training/profiles/${encodeURIComponent(profileId)}/goal-settings/generate`, {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId || null,
      trainee_id: traineeId,
      training_mode: 'open',
      model_mode: modelMode || null,
    }),
  })
}

export function startTrainingSession(payload: TrainingSessionStartPayload) { // 创建一次销售陪练会话
  return request<TrainingSessionResponse>('/training/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listTrainingSessions(page = 1, pageSize = 8, traineeId?: string) { // 查询销售陪练历史
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (traineeId?.trim()) params.set('trainee_id', traineeId.trim())
  return request<TrainingSessionListResponse>(`/training/sessions?${params.toString()}`)
}

export function getTrainingSessionDetail(sessionId: string) { // 查询销售陪练复盘详情
  return request<TrainingSessionDetailResponse>(`/training/sessions/${encodeURIComponent(sessionId)}`)
}

export function submitTrainingTurn(sessionId: string, payload: TrainingTurnPayload) { // 一次性提交学员回复并等待 AI 客户完整回复
  return request<TrainingTurnResponse>(`/training/sessions/${encodeURIComponent(sessionId)}/turns?stream=false`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function generateTrainingFinalScore(sessionId: string, modelMode?: string | null) { // 结束训练并生成评分报告
  const query = modelMode ? `?model_mode=${encodeURIComponent(modelMode)}` : ''
  return request<TrainingScoreResponse>(`/training/sessions/${encodeURIComponent(sessionId)}/final-score${query}`, {
    method: 'POST',
  })
}

export async function submitTrainingTurnStream(
  sessionId: string,
  payload: TrainingTurnPayload,
  handlers: TrainingStreamHandlers,
  signal?: AbortSignal,
) { // 流式提交学员回复，逐段接收 AI 客户话术
  const response = await fetch(`${API_BASE_URL}/training/sessions/${encodeURIComponent(sessionId)}/turns?stream=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({ ...payload, response_mode: 'stream' }),
    signal,
  })

  if (!response.ok || !response.body) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  async function handleTrainingEvent(eventText: string) {
    const eventName = eventText
      .split(/\r?\n/)
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim()

    const dataText = eventText
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')

    if (!eventName || !dataText) return

    const data = JSON.parse(dataText)
    if (eventName === 'retrieval_done') {
      await handlers.onRetrieval?.(data)
    } else if (eventName === 'customer_delta') {
      await handlers.onDelta?.(String(data.content || ''))
    } else if (eventName === 'stage_decision') {
      await handlers.onStageDecision?.(data)
    } else if (eventName === 'turn_done') {
      await handlers.onDone?.(data as TrainingTurnResponse)
    } else if (eventName === 'error') {
      throw new Error(String(data.error || '训练流式生成失败'))
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const eventText of events) {
      await handleTrainingEvent(eventText)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    await handleTrainingEvent(buffer)
  }
}

export function sendChat(
  message: string,
  userId: string,
  conversationId: string | null,
  modelMode: ModelMode,
  collectionName: string,
  signal?: AbortSignal,
) { // 一次性聊天请求函数
  // 一次性聊天请求：
  // - 前端发送 message 和 user_id。
  // - 后端完整执行 Agent。
  // - 浏览器等到完整 JSON 返回后，才会拿到 response.answer。
  // - 适合“最终答案一次展示”的模式。
  return request<ChatResponse>('/chat', { // 请求后端 `/chat` 一次性接口
    method: 'POST', // 聊天请求携带 JSON 请求体，所以使用 POST
    body: JSON.stringify({
      message,
      user_id: userId,
      conversation_id: conversationId,
      model_mode: modelMode,
      collection_name: collectionName,
    }), // 携带会话 ID 和当前 collection
    signal, // 允许外部通过 AbortController 取消请求
  })
}

export async function sendChatStream(
  message: string, // 用户输入的问题
  userId: string, // 当前会话用户 ID
  conversationId: string | null, // 当前会话 ID，首轮为空时后端会创建
  modelMode: ModelMode, // 当前回答模型档位
  collectionName: string, // 当前检索的 Qdrant collection
  onChunk: (content: string) => void | Promise<void>, // 每收到一个回答片段时调用的回调
  onConversationId: (conversationId: string) => void, // 收到后端会话 ID 时调用
  onMetrics?: (metrics: { first_token_ms?: number | null; total_ms?: number | null }) => void, // 收到耗时指标时调用
  signal?: AbortSignal, // 可选取消信号，用于停止生成
) { // 流式聊天请求函数
  // 流式聊天请求：
  // - 仍然使用 POST，因为请求体里需要传 JSON 参数。
  // - 返回值不是 JSON，而是 text/event-stream 文本流。
  // - fetch 拿到 response 后，通过 response.body.getReader() 一段段读取字节。
  // - 每解析出一个 SSE chunk，就调用 onChunk，把内容追加到当前助手消息。
  const response = await fetch(`${API_BASE_URL}/chat/stream`, { // 请求后端 `/chat/stream` 流式接口
    method: 'POST', // 流式接口同样需要提交 JSON 请求体
    headers: { // 设置流式请求头
      'Content-Type': 'application/json', // 请求体格式是 JSON
      // 明确告诉后端和可能存在的代理层：客户端期望接收 SSE。
      Accept: 'text/event-stream', // 期望后端返回 SSE 文本流
      // 本地开发或代理场景下，避免缓存层把流式响应攒完整再交给浏览器。
      'Cache-Control': 'no-cache', // 告诉中间层不要缓存当前请求
    },
    body: JSON.stringify({
      message,
      user_id: userId,
      conversation_id: conversationId,
      model_mode: modelMode,
      collection_name: collectionName,
    }), // 请求体带上 conversation_id 和当前 collection
    // AbortSignal 用于“停止生成”按钮。
    // 前端调用 abort() 后，fetch 会中断读取，后续 catch 分支会显示“已停止生成”。
    signal, // 把取消信号交给 fetch
  })

  if (!response.ok || !response.body) { // 状态码异常，或者浏览器没有提供可读流
    // 流式接口如果连响应体都没有，说明请求还没进入正常 SSE 流程。
    const text = await response.text() // 读取错误内容
    throw new Error(text || `Request failed: ${response.status}`) // 抛给页面层显示
  }

  // reader 每次读取的是浏览器当前收到的一段二进制数据。
  // 这一段数据不一定刚好对应一个完整 SSE 事件：
  // - 可能半个事件被拆到两次 read()。
  // - 也可能多个事件合并在同一次 read()。
  const reader = response.body.getReader() // 从响应体里拿到流式 reader

  // SSE 是 UTF-8 文本协议，TextDecoder 负责把 Uint8Array 转成字符串。
  // `{ stream: true }` 能正确处理一个中文字符被拆到两个网络包里的情况。
  const decoder = new TextDecoder('utf-8') // 创建 UTF-8 解码器

  // buffer 保存“已经收到但还没有形成完整 SSE 事件”的残留文本。
  // 没有这个 buffer，遇到半个事件时 JSON.parse 就会失败。
  let buffer = '' // 保存尚未解析完成的 SSE 文本

  async function handleEvent(eventText: string) { // 处理一个完整 SSE 事件
    // 一个 SSE 事件可能包含多行，例如：
    //
    // event: chunk
    // data: {"content":"你好"}
    //
    // 这里只关心 data 行；event 行只用于表达事件类型，当前前端通过 data 内容判断即可。
    const dataText = eventText // 从完整 SSE 事件里提取 data 内容
      .split(/\r?\n/) // 按行切分，兼容 \n 和 \r\n
      .filter((line) => line.startsWith('data:')) // 只保留 data 行，忽略 event 行
      .map((line) => line.slice(5).trimStart()) // 去掉 `data:` 前缀和前导空格
      .join('\n') // 多个 data 行按 SSE 规范合并

    if (!dataText) return // 没有 data 的事件直接忽略

    // 后端约定 data 是 JSON：
    // - {"content": "..."} 表示回答片段。
    // - {"error": "..."} 表示生成失败。
    // - {"done": true} 表示结束；前端无需额外处理，reader 结束即可收尾。
    const data = JSON.parse(dataText) // 把 data 字符串解析成对象
    if (data.conversation_id) { // meta/done 事件会带回会话 ID
      onConversationId(data.conversation_id) // 保存到页面状态，后续请求继续携带
    }
    if (data.first_token_ms !== undefined || data.total_ms !== undefined) { // metric/done 事件会带耗时
      onMetrics?.({
        first_token_ms: data.first_token_ms ?? null,
        total_ms: data.total_ms ?? null,
      }) // 把耗时交给 App.vue 展示
    }
    if (data.content) { // content 表示一个正常回答片段
      // 必须 await onChunk：
      // - App.vue 里的 onChunk 会更新 Vue 响应式消息内容。
      // - 随后会等待 nextTick 滚动到底部。
      // - 如果不 await，多个 chunk 可能在同一个任务里被快速处理，页面看起来更像一次性刷新。
      await onChunk(data.content) // 把回答片段交给 App.vue 追加到页面
    }
    if (data.error) { // error 表示后端生成过程中出错
      throw new Error(data.error) // 抛出错误，进入 App.vue 的 catch 分支
    }
  }

  while (true) { // 持续读取后端流，直到后端关闭响应
    const { value, done } = await reader.read() // 读取一段二进制数据
    if (done) break // done=true 表示后端流结束

    // 把本次收到的字节追加进 buffer。
    buffer += decoder.decode(value, { stream: true }) // 解码本次收到的字节并追加到 buffer

    // SSE 事件之间用空行分隔。
    // 这里兼容两种换行：
    // - \n\n：后端代码直接 yield 的格式。
    // - \r\n\r\n：某些代理或工具显示 HTTP 文本时可能出现的格式。
    const events = buffer.split(/\r?\n\r?\n/) // 按空行切分出完整 SSE 事件

    // split 后最后一段可能是不完整事件，不能立刻解析，先留到下一次 read()。
    buffer = events.pop() || '' // 最后一段可能不完整，继续留在 buffer

    for (const eventText of events) { // 遍历本次解析出的完整事件
      // 逐个处理完整事件，处理顺序与后端发送顺序一致。
      await handleEvent(eventText) // 按顺序处理事件
    }
  }

  // reader 结束后，decoder.decode() 不带参数可以刷新 TextDecoder 内部残留字节。
  buffer += decoder.decode() // 刷新 TextDecoder 内部可能残留的字节

  // 理论上标准 SSE 最后会有空行，buffer 应该为空。
  // 这里兜底处理最后一个没有空行结尾的事件，增强兼容性。
  if (buffer.trim()) { // 如果最后仍然残留了一个未处理事件
    await handleEvent(buffer) // 兜底处理最后事件
  }
}
