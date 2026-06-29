import { buildRequestHeaders, fetchWithAuth, readErrorMessage, request } from '../../../shared/api/http'
import type { IngestTaskResponse, TrainingGoalSettingResponse, TrainingKnowledgeBatchListResponse, TrainingKnowledgeChunkListResponse, TrainingKnowledgeDeleteResponse, TrainingKnowledgePreviewResponse, TrainingKnowledgePublishResponse, TrainingKnowledgeReparseResponse, TrainingKnowledgeRollbackResponse, TrainingKnowledgeUploadPayload, TrainingKnowledgeUploadResponse, TrainingKnowledgeVersionListResponse, TrainingPlanCreatePayload, TrainingPlanDeleteResponse, TrainingPlanDetailResponse, TrainingPlanListResponse, TrainingPlanUpdatePayload, TrainingRoleGeneratePayload, TrainingRoleGenerateResponse, TrainingScenarioPolishPayload, TrainingScenarioPolishResponse, TrainingScoreResponse, TrainingSessionDetailResponse, TrainingSessionListResponse, TrainingSessionResponse, TrainingSessionStartPayload, TrainingStreamHandlers, TrainingSupplementQuestionGenerateResponse, TrainingTurnPayload, TrainingTurnResponse } from '../types'

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
  const response = await fetchWithAuth('/training/knowledge/upload', {
    method: 'POST',
    body: formData,
  }, false)

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

export function retryIngestTask(taskId: string) { // 重试失败的异步入库任务
  return request<IngestTaskResponse>(`/ingest-tasks/${encodeURIComponent(taskId)}/retry`, {
    method: 'POST',
  })
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

export function deleteTrainingPlan(planId: string) { // 删除训练方案，只移除方案入口，不删除训练资料
  return request<TrainingPlanDeleteResponse>(`/training/plans/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
  })
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
  const response = await fetchWithAuth(`/training/sessions/${encodeURIComponent(sessionId)}/turns?stream=true`, {
    method: 'POST',
    headers: buildRequestHeaders({
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    }),
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
