export interface TrainingKnowledgeDisplaySource {
  status?: string | null
  task_status?: string | null
  current_step?: string | null
  progress?: number | null
  quality_report?: Record<string, unknown> | null
  error_message?: string | null
}

export interface TrainingKnowledgeFlowStep {
  key: string
  label: string
  status: 'done' | 'active' | 'failed' | 'waiting'
}

export interface TrainingKnowledgeQualityMetricItem {
  label: string
  value: string
}

const FLOW_STEPS = [
  { key: 'saving', label: '保存文件' },
  { key: 'parsing', label: '解析内容' },
  { key: 'chunking', label: '生成切片' },
  { key: 'scoring', label: '质量评分' },
  { key: 'indexing', label: '写入向量' },
  { key: 'review', label: '待确认发布' },
]

const STEP_ORDER: Record<string, number> = {
  queued: 0,
  running: 0,
  saving: 0,
  parsing: 1,
  chunking: 2,
  llm_chunking: 2,
  scoring: 3,
  indexing: 4,
  indexing_staging: 4,
  succeeded: 5,
  pending_review: 5,
  published: 5,
}

const ACTIVE_TASK_STATUSES = new Set(['queued', 'running'])
const ACTIVE_BATCH_STATUSES = new Set(['parsing', 'embedding'])
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

// 本文件要被 Node 原生测试直接加载，所以保留独立格式化逻辑，不依赖 Vue/Vite 的路径解析。
function displayQualityValue(value: unknown): string {
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object' && value) return JSON.stringify(value, null, 2)
  return String(value ?? '')
}

// 把后端 warnings 字段统一转为字符串数组，兼容空值和异常结构。
function safeWarningList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

// 把 0-1 的比例转换成百分比，上传质量卡片里展示单一片段占比。
function displayRatioPercent(value: unknown): string {
  const ratio = Number(value)
  if (!Number.isFinite(ratio)) return displayQualityValue(value)
  return `${Number((ratio * 100).toFixed(1))}%`
}

// 只在质量指标值存在时加入展示列表，避免空字段占用上传结果卡片空间。
function addQualityMetricItem(
  items: TrainingKnowledgeQualityMetricItem[],
  label: string,
  value: unknown,
  formatter: (source: unknown) => string = displayQualityValue,
) {
  if (value === undefined || value === null) return
  if (Array.isArray(value) && value.length === 0) return
  if (typeof value === 'string' && value.trim() === '') return
  items.push({ label, value: formatter(value) })
}

// 判断训练资料入库任务是否仍在处理，避免页面把处理中批次误判为完成。
function isDisplayProcessing(item: TrainingKnowledgeDisplaySource | null | undefined) {
  if (!item) return false

  const taskStatus = String(item.task_status || '').trim()
  if (ACTIVE_TASK_STATUSES.has(taskStatus)) return true
  if (taskStatus === 'succeeded' || taskStatus === 'failed') return false

  return ACTIVE_BATCH_STATUSES.has(String(item.status || '').trim())
}

// 规范化进度百分比，防止后端异常值撑坏进度条。
function displayProgress(item: TrainingKnowledgeDisplaySource | null | undefined) {
  const progress = Number(item?.progress ?? 0)
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, Math.round(progress)))
}

// 获取当前入库步骤的中文名称，未知状态保留明确占位。
function displayStepLabel(item: TrainingKnowledgeDisplaySource | null | undefined) {
  const currentStep = String(item?.current_step || '').trim()
  if (currentStep && STEP_LABELS[currentStep]) return STEP_LABELS[currentStep]

  const taskStatus = String(item?.task_status || '').trim()
  if (taskStatus && STEP_LABELS[taskStatus]) return STEP_LABELS[taskStatus]

  const batchStatus = String(item?.status || '').trim()
  if (batchStatus && STEP_LABELS[batchStatus]) return STEP_LABELS[batchStatus]

  return '等待上传'
}

// 根据任务状态生成上传流程节点，页面可以固定展示当前处理到哪一步。
export function trainingKnowledgeFlowSteps(
  item: TrainingKnowledgeDisplaySource | null | undefined,
): TrainingKnowledgeFlowStep[] {
  const currentStep = String(item?.current_step || item?.status || item?.task_status || '').trim()
  const isFailed = item?.task_status === 'failed' || String(item?.status || '').endsWith('_failed')
  const currentIndex = STEP_ORDER[currentStep] ?? (item ? 0 : -1)
  const failedIndex = Math.max(0, Math.min(currentIndex, FLOW_STEPS.length - 1))

  return FLOW_STEPS.map((step, index) => {
    if (!item) return { ...step, status: 'waiting' }
    if (isFailed && index === failedIndex) return { ...step, status: 'failed' }
    if (index < currentIndex || item.status === 'published') return { ...step, status: 'done' }
    if (index === currentIndex && isDisplayProcessing(item)) return { ...step, status: 'active' }
    if (index === currentIndex && item.status === 'pending_review') return { ...step, status: 'active' }
    return { ...step, status: 'waiting' }
  })
}

// 生成上传流程摘要，避免用户只看到一个状态码。
export function trainingKnowledgeFlowSummary(item: TrainingKnowledgeDisplaySource | null | undefined) {
  if (!item) return '等待选择文件'
  if (item.task_status === 'failed' || String(item.status || '').endsWith('_failed')) {
    return item.error_message || '处理失败，可重试或重新上传'
  }
  if (isDisplayProcessing(item)) {
    return `${displayStepLabel(item)} · ${displayProgress(item)}%`
  }
  if (item.status === 'pending_review') return '切片和评分已完成，等待确认发布'
  if (item.status === 'published') return '资料已发布，已参与销售陪练检索'
  return displayStepLabel(item)
}

// 生成质量分展示文案；评分未完成时仍给出明确占位。
export function trainingKnowledgeQualitySummary(report: Record<string, unknown> | null | undefined) {
  if (!report || report.score === undefined || report.score === null) {
    return {
      scoreText: '待评分',
      levelText: '质量评分未生成',
      detailText: '后台完成切片后会显示文档得分',
      warningCount: 0,
    }
  }

  const warnings = safeWarningList(report.warnings)
  const summary = displayQualityValue(report.summary || '已生成质量报告')
  const level = displayQualityValue(report.level || 'unknown')
  return {
    scoreText: `${displayQualityValue(report.score)} 分`,
    levelText: level,
    detailText: summary,
    warningCount: warnings.length,
  }
}

// 返回质量报告里的全部告警，不再只截取前三条，方便上传后一次性看到所有风险点。
export function trainingKnowledgeQualityWarnings(report: Record<string, unknown> | null | undefined) {
  return safeWarningList(report?.warnings).filter((item) => item.trim())
}

// 把后端质量 metrics 转成中文标签，上传质量卡片直接展示这些可解释指标。
export function trainingKnowledgeQualityMetricItems(
  report: Record<string, unknown> | null | undefined,
): TrainingKnowledgeQualityMetricItem[] {
  const metrics = (report?.metrics || {}) as Record<string, unknown>
  const items: TrainingKnowledgeQualityMetricItem[] = []

  addQualityMetricItem(items, '切片数', metrics.chunk_count)
  addQualityMetricItem(items, '案例数', metrics.case_count)
  addQualityMetricItem(items, '平均字数', metrics.avg_chunk_chars)
  addQualityMetricItem(items, '最长切片', metrics.max_chunk_chars)
  addQualityMetricItem(items, '过长切片', metrics.oversize_chunk_count)
  addQualityMetricItem(items, '缺少核心片段', metrics.missing_required_parts)
  addQualityMetricItem(items, '缺少推荐片段', metrics.missing_recommended_parts)
  addQualityMetricItem(items, '单一片段占比', metrics.single_part_ratio, displayRatioPercent)

  return items
}

// 把切分器内部编码转成页面能直接阅读的中文说明。
export function trainingKnowledgeSplitterLabel(report: Record<string, unknown> | null | undefined) {
  const splitter = String(report?.selected_splitter || '').trim()
  if (splitter === 'llm_fallback') return 'LLM 兜底切分'
  if (report?.llm_fallback_attempted) return '规则切分，已尝试 LLM 兜底'
  if (splitter === 'rule_config') return '规则配置切分'
  return '等待切分结果'
}
