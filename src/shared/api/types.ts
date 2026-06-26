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

export interface TrainingPlanDeleteResponse { // 销售训练方案删除结果
  status: string
  plan_id: string
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


export interface AuthUser { // 当前登录用户，来自后端 `/auth/me`
  user_id: string
  username: string
  display_name: string
  role: string
  status: string
}

export interface LoginPayload { // 登录请求体
  username: string
  password: string
}

export interface LoginResponse { // 登录成功后的 token 和用户信息
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}
