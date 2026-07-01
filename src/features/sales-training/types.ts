export type TrainingResponseMode = 'stream' | 'blocking'

export interface TrainingKnowledgeUploadPayload { // 销售训练知识上传请求
  file: File // LMS 训练案例文件
  sourceType?: string // 知识来源类型，一期默认 lms_case
  modelMode?: string | null // LLM 兜底切分使用的模型档位，默认 high
  createdBy?: string // 上传人
}

export interface TrainingKnowledgeUploadResponse { // 销售训练知识入库结果
  batch_id: string
  document_id?: string | null
  task_id?: string | null
  task_status?: string | null
  current_step?: string | null
  progress?: number | null
  status: string
  chunk_count: number
  point_count: number
  source_file?: string | null
  duplicate_of?: string | null
  error_message?: string | null
  quality_report: Record<string, unknown>
  failed_chunks: string[]
}

export interface TrainingKnowledgeBatchResponse { // 训练资料上传批次
  batch_id: string
  document_id?: string | null
  task_id?: string | null
  task_status?: string | null
  current_step?: string | null
  progress?: number | null
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

export interface TrainingKnowledgePreviewResponse { // 训练资料上传文件预览
  batch: TrainingKnowledgeBatchResponse
  preview_type: string
  content: string
  truncated: boolean
  file_url?: string | null
  charset?: string | null
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
  task_id?: string | null
  task_status?: string | null
  current_step?: string | null
  progress?: number | null
  status: string
  chunk_count: number
  point_count: number
  source_file?: string | null
  error_message?: string | null
  quality_report: Record<string, unknown>
}

export interface IngestTaskResponse { // 异步入库任务状态
  task_id: string
  task_type: string
  business_scene?: string | null
  document_id?: string | null
  batch_id?: string | null
  task_status: string
  status: string
  current_step: string
  progress: number
  attempt_count: number
  max_attempts: number
  error_message?: string | null
  metadata: Record<string, unknown>
  created_at?: string | null
  updated_at?: string | null
  started_at?: string | null
  finished_at?: string | null
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
