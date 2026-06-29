export interface TrainingIngestTaskState {
  status?: string | null
  task_status?: string | null
  current_step?: string | null
  progress?: number | null
}

const ACTIVE_TASK_STATUSES = new Set(['queued', 'running'])
const ACTIVE_BATCH_STATUSES = new Set(['parsing', 'embedding'])
const CHUNK_READABLE_BATCH_STATUSES = new Set(['pending_review', 'published'])
const PUBLISHABLE_BATCH_STATUSES = new Set(['pending_review', 'publish_failed'])
const REPARSEABLE_BATCH_STATUSES = new Set(['pending_review', 'parsing_failed', 'publish_failed'])

const STEP_LABELS: Record<string, string> = {
  queued: '等待处理',
  running: '任务启动中',
  saving: '文件保存完成',
  parsing: '正在解析文件',
  chunking: '正在生成切片',
  llm_chunking: 'LLM 正在优化切片',
  scoring: '正在生成质量评分',
  indexing: '正在写入向量库',
  indexing_staging: '正在写入临时向量库',
  succeeded: '处理完成',
  failed: '处理失败',
}

function normalizeCode(value: string | null | undefined) {
  return String(value || '').trim()
}

export function isTrainingIngestProcessing(item: TrainingIngestTaskState | null | undefined) {
  if (!item) return false

  const taskStatus = normalizeCode(item.task_status)
  if (ACTIVE_TASK_STATUSES.has(taskStatus)) return true
  if (taskStatus === 'succeeded' || taskStatus === 'failed') return false

  return ACTIVE_BATCH_STATUSES.has(normalizeCode(item.status))
}

export function trainingIngestProgress(item: TrainingIngestTaskState | null | undefined) {
  const progress = Number(item?.progress ?? 0)
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, Math.round(progress)))
}

export function trainingIngestStepLabel(item: TrainingIngestTaskState | null | undefined) {
  const currentStep = normalizeCode(item?.current_step)
  if (currentStep && STEP_LABELS[currentStep]) return STEP_LABELS[currentStep]

  const taskStatus = normalizeCode(item?.task_status)
  if (taskStatus && STEP_LABELS[taskStatus]) return STEP_LABELS[taskStatus]

  const batchStatus = normalizeCode(item?.status)
  if (batchStatus && STEP_LABELS[batchStatus]) return STEP_LABELS[batchStatus]

  return '等待上传'
}

export function canOpenTrainingKnowledgeChunks(item: TrainingIngestTaskState | null | undefined) {
  return Boolean(item && !isTrainingIngestProcessing(item) && CHUNK_READABLE_BATCH_STATUSES.has(normalizeCode(item.status)))
}

export function canPublishTrainingKnowledgeBatch(item: TrainingIngestTaskState | null | undefined) {
  return Boolean(item && !isTrainingIngestProcessing(item) && PUBLISHABLE_BATCH_STATUSES.has(normalizeCode(item.status)))
}

export function canReparseTrainingKnowledgeBatch(item: TrainingIngestTaskState | null | undefined) {
  return Boolean(item && !isTrainingIngestProcessing(item) && REPARSEABLE_BATCH_STATUSES.has(normalizeCode(item.status)))
}

export function canDeleteTrainingKnowledgeBatch(item: TrainingIngestTaskState | null | undefined) {
  if (!item) return true

  const taskStatus = normalizeCode(item.task_status)
  if (taskStatus === 'running') return false
  if (taskStatus === 'queued' || taskStatus === 'failed' || taskStatus === 'succeeded') return true

  return !ACTIVE_BATCH_STATUSES.has(normalizeCode(item.status))
}
