<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Activity,
  ArrowLeft,
  Bot,
  BrainCircuit,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Eye,
  FileText,
  GraduationCap,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  confirmKnowledgeUpload,
  createDictionaryGroup,
  createDictionaryItem,
  deleteDictionaryGroup,
  deleteDictionaryItem,
  deleteExamSession,
  deleteKnowledgeFile,
  fetchHealth,
  getConversationDetail,
  getExamSessionDetail,
  listConversations,
  listDictionaries,
  listExamSessions,
  listKnowledgeFiles,
  previewKnowledgeDocument,
  previewKnowledgeFile,
  recommendKnowledgeUpload,
  reindexAllKnowledgeFiles,
  reindexKnowledgeFile,
  setDictionaryItemEnabled,
  updateDictionaryGroup,
  updateDictionaryItem,
  type ConversationSummaryResponse,
  type DictionaryGroupResponse,
  type DictionaryItemResponse,
  type ExamSessionDetailResponse,
  type ExamSessionSummary,
  type HealthResponse,
  type KnowledgeFilePreviewResponse,
  type KnowledgeFileResponse,
  type KnowledgeUploadPreviewResponse,
  type KnowledgeUploadRecommendResponse,
} from '../../../shared/api'
import {
  deleteTrainingKnowledgeBatch,
  listTrainingKnowledgeBatchVersions,
  listTrainingKnowledgeBatches,
  listTrainingKnowledgeChunks,
  listTrainingPlans,
  listTrainingSessions,
  previewTrainingKnowledgeBatch,
  publishTrainingKnowledgeBatch,
  reparseTrainingKnowledgeBatch,
  rollbackTrainingKnowledgeBatch,
  uploadTrainingKnowledge,
} from '../../sales-training/api'
import type {
  TrainingKnowledgeBatchResponse,
  TrainingKnowledgeChunkResponse,
  TrainingKnowledgePreviewResponse,
  TrainingKnowledgeUploadResponse,
  TrainingPlanSummaryResponse,
  TrainingSessionSummaryResponse,
} from '../../sales-training/types'
import { displayOptionLabel, safeList, sortTrainingBatchesByImportTime, valueList } from '../../sales-training/composables/trainingDisplay'
import TrainingKnowledgeWorkspace from '../../sales-training/components/TrainingKnowledgeWorkspace.vue'
import TrainingKnowledgeUploadPanel from '../../sales-training/components/TrainingKnowledgeUploadPanel.vue'
import FilePreviewDialog from '../../../shared/components/FilePreviewDialog.vue'

defineProps<{ themeMode: 'dark' | 'light' }>()
const emit = defineEmits<{
  openChatHistory: [conversationId: string]
  openSalesTraining: []
}>()

interface DictionaryFormState { // 字典项编辑表单，字段和后端字典项保存接口一一对应
  dictionaryCode: string
  dictionaryName: string
  itemCode: string
  itemName: string
  parentItemId: string
  sortOrder: number
  enabled: boolean
  description: string
  metadataText: string
}

interface DictionaryGroupFormState { // 父级字典编辑表单，用于新增或修改字典分组
  dictionaryCode: string
  dictionaryName: string
}

type KnowledgeDialogTab = 'general' | 'salesTraining'

const TRAINING_COLLECTION_NAMES = new Set(['sales_training_cases', 'sales_training_cases_staging'])

function isTrainingCollection(collectionName: string | null | undefined) {
  return TRAINING_COLLECTION_NAMES.has(String(collectionName || '').trim())
}

interface ChunkTypeSummary { // 训练资料切片按“案例组成部分”聚合后的展示结构
  casePart: string
  label: string
  count: number
  usageLabels: string[]
  sampleText: string
}

const loading = ref(false) // 首页总览刷新状态
const health = ref<HealthResponse | null>(null) // 后端健康检查结果
const knowledgeFiles = ref<KnowledgeFileResponse[]>([]) // 后端知识库文件列表
const dictionaries = ref<DictionaryGroupResponse[]>([]) // 后端系统字典分组
const conversations = ref<ConversationSummaryResponse[]>([]) // 最近会话列表
const examSessions = ref<ExamSessionSummary[]>([]) // 首页考试记录列表
const conversationTotal = ref(0) // 会话总数
const examSessionTotal = ref(0) // 考试记录总数
const conversationTooltipMap = ref<Record<string, string>>({}) // 最近会话悬浮提示，优先展示完整用户问题
const trainingBatches = ref<TrainingKnowledgeBatchResponse[]>([]) // 首页销售训练资料批次概览
const trainingBatchTotal = ref(0) // 销售训练资料批次总数
const trainingPlans = ref<TrainingPlanSummaryResponse[]>([]) // 首页销售训练方案概览
const trainingPlanTotal = ref(0) // 销售训练方案总数
const trainingSessions = ref<TrainingSessionSummaryResponse[]>([]) // 首页销售训练会话概览
const trainingSessionTotal = ref(0) // 销售训练会话总数
const overviewConversationPage = ref(1) // 首页最近会话分页页码
const overviewConversationPageSize = 6 // 首页最近会话每页展示 6 条
const overviewExamSessionPage = ref(1) // 首页考试记录分页页码
const overviewExamSessionPageSize = 6 // 首页考试记录每页展示 6 条
const overviewTrainingSessionPage = ref(1) // 首页最近训练分页页码
const overviewTrainingBatchPage = ref(1) // 首页训练资料分页页码
const overviewSalesCardPageSize = 3 // 首页销售驾驶舱卡片每页展示 3 条，和卡片高度保持一致

const recentConversationDialogVisible = ref(false) // 最近会话弹窗开关
const examRecordDialogVisible = ref(false) // 考试记录弹窗开关
const examDetailVisible = ref(false) // 考试详情弹窗开关
const examDetailLoading = ref(false) // 考试详情加载状态
const examDeletingId = ref('') // 当前正在删除的考试会话编号
const selectedExamDetail = ref<ExamSessionDetailResponse | null>(null) // 当前查看的考试详情
const knowledgeDialogVisible = ref(false) // 知识库管理弹窗开关
const knowledgeDialogTab = ref<KnowledgeDialogTab>('general') // 首页知识库弹窗当前页签：通用知识库或销售训练资料
const knowledgeLoading = ref(false) // 知识库文件列表加载状态
const knowledgeKeyword = ref('') // 知识库文件名搜索关键词
const knowledgeFileInput = ref<HTMLInputElement | null>(null) // 隐藏文件选择框
const activeKnowledgeCollection = ref('') // 当前知识库 collection 页签
const knowledgePage = ref(1) // 知识库文件分页页码
const knowledgePageSize = 9 // 知识库文件每页 9 个，页面上保持三列三行
const activeKnowledgeAction = ref('') // 当前知识库文件操作 loading key
const reindexingAll = ref(false) // 批量重建索引状态
const uploadingKnowledge = ref(false) // 上传预览状态
const confirmingKnowledge = ref(false) // 确认入库状态
const recommendingKnowledge = ref(false) // 模型推荐切分方式状态
const uploadPreviewVisible = ref(false) // 上传确认弹窗开关
const uploadPreview = ref<KnowledgeUploadPreviewResponse | null>(null) // 上传预解析结果
const uploadRecommendation = ref<KnowledgeUploadRecommendResponse | null>(null) // 模型推荐结果
const selectedDocumentType = ref('') // 用户最终选择的文档结构
const selectedSplitStrategy = ref('') // 用户最终选择的切分策略
const selectedUploadCollection = ref('agent') // 上传文件写入的 collection
const knowledgePreviewVisible = ref(false) // 文件预览弹窗开关
const knowledgePreviewLoading = ref(false) // 文件预览加载状态
const knowledgePreview = ref<KnowledgeFilePreviewResponse | null>(null) // 文件预览内容
const trainingKnowledgeSelectedFile = ref<File | null>(null) // 销售训练资料待上传文件
const trainingKnowledgeUploadResult = ref<TrainingKnowledgeUploadResponse | null>(null) // 销售训练资料上传后的临时解析结果
const trainingKnowledgeChunks = ref<TrainingKnowledgeChunkResponse[]>([]) // 当前选中训练资料批次的切片列表
const trainingKnowledgeBatchPage = ref(1) // 销售训练资料批次分页页码
const trainingKnowledgeBatchTotal = ref(0) // 销售训练资料批次总数
const trainingKnowledgeActiveBatchId = ref('') // 当前正在查看切片的训练资料批次 ID
const trainingKnowledgeLoadingBatches = ref(false) // 训练资料批次列表加载状态
const trainingKnowledgeLoadingChunks = ref(false) // 训练资料切片加载状态
const trainingKnowledgeUploading = ref(false) // 训练资料上传状态
const trainingKnowledgePublishingBatchId = ref('') // 正在发布的训练资料批次 ID
const trainingKnowledgeRollingBackBatchId = ref('') // 正在回滚的训练资料批次 ID
const trainingKnowledgeReparsingBatchId = ref('') // 正在重新切分的训练资料批次 ID
const trainingKnowledgePreviewingBatchId = ref('') // 正在预览训练资料的批次 ID
const trainingKnowledgeDeletingBatchId = ref('') // 正在删除的训练资料批次 ID
const trainingKnowledgeVersionDialogVisible = ref(false) // 训练资料版本链弹窗开关
const trainingKnowledgeVersionLoading = ref(false) // 训练资料版本链加载状态
const trainingKnowledgeBatchVersions = ref<TrainingKnowledgeBatchResponse[]>([]) // 当前训练资料版本链
const trainingKnowledgeActiveVersionGroupId = ref('') // 当前版本组 ID
const trainingKnowledgeActiveChunkSummary = ref<ChunkTypeSummary | null>(null) // 当前打开的切片类型汇总
const trainingKnowledgeChunkStructureVisible = ref(false) // 训练资料切片结构弹窗开关
const trainingKnowledgeChunkDetailVisible = ref(false) // 切片详情弹窗开关
const trainingKnowledgePreview = ref<TrainingKnowledgePreviewResponse | null>(null) // 训练资料原文件预览
const trainingKnowledgePreviewVisible = ref(false) // 训练资料预览弹窗开关
const trainingKnowledgePreviewLoading = ref(false) // 训练资料预览加载状态
const dictionaryDialogVisible = ref(false) // 字典表管理弹窗开关
const dictionaryLoading = ref(false) // 字典表加载状态
const activeDictionaryCode = ref('') // 当前进入详情的父级字典编码
const dictionaryPage = ref(1) // 父级字典分页页码
const dictionaryPageSize = 8 // 父级字典每页展示数量
const dictionaryGroupDialogVisible = ref(false) // 父级字典编辑弹窗开关
const dictionaryGroupSaving = ref(false) // 父级字典保存状态
const dictionaryItemDialogVisible = ref(false) // 字典项编辑弹窗开关
const dictionaryItemSaving = ref(false) // 字典项保存状态
const activeDictionaryAction = ref('') // 当前字典操作 loading key
const editingDictionaryGroupCode = ref('') // 当前正在编辑的父级字典编码
const editingDictionaryItemId = ref('') // 当前正在编辑的字典项 ID
const dictionaryGroupForm = ref<DictionaryGroupFormState>({
  dictionaryCode: '',
  dictionaryName: '',
})
const dictionaryForm = ref<DictionaryFormState>({
  dictionaryCode: '',
  dictionaryName: '',
  itemCode: '',
  itemName: '',
  parentItemId: '',
  sortOrder: 0,
  enabled: true,
  description: '',
  metadataText: '{}',
})

const trainingPublishedBatchCount = computed(() => trainingBatches.value.filter((item) => trainingStatusKind(item.status) === 'published').length)
const trainingPendingBatchCount = computed(() => trainingBatches.value.filter((item) => trainingStatusKind(item.status) === 'pending').length)
const trainingFailedBatchCount = computed(() => trainingBatches.value.filter((item) => trainingStatusKind(item.status) === 'failed').length)
const trainingPlanReadyCount = computed(() => trainingPlans.value.filter((item) => item.active_profile_id && item.active_setting_id).length)
const trainingPlanStaleCount = computed(() => trainingPlans.value.filter((item) => [item.role_status, item.goal_status, item.score_status].includes('stale')).length)
const trainingActiveSessionCount = computed(() => trainingSessions.value.filter((item) => item.status === 'active').length)
const trainingScoringSessionCount = computed(() => trainingSessions.value.filter((item) => item.status === 'scoring').length)
const trainingCompletedSessionCount = computed(() => trainingSessions.value.filter((item) => item.status === 'completed').length)
const trainingVectorPoints = computed(() => Number(health.value?.collection_points?.sales_training_cases || 0))
const trainingStagingVectorPoints = computed(() => Number(health.value?.collection_points?.sales_training_cases_staging || 0))
const latestTrainingSession = computed(() => trainingSessions.value[0])
const latestTrainingPlan = computed(() => trainingPlans.value[0])
const trainingKnowledgeCurrentUploadChunkCount = computed(() => trainingKnowledgeUploadResult.value?.chunk_count ?? 0)
const trainingKnowledgeCurrentUploadPointCount = computed(() => trainingKnowledgeUploadResult.value?.point_count ?? 0)
const trainingKnowledgeCurrentUploadStatus = computed(() => trainingKnowledgeBatchStatusLabel(trainingKnowledgeUploadResult.value?.status || 'waiting'))
const trainingKnowledgeCurrentUploadDuplicateText = computed(() => trainingKnowledgeUploadResult.value?.duplicate_of ? '已复用' : '未重复')
const trainingKnowledgeCanClearUploadArea = computed(() => Boolean(trainingKnowledgeSelectedFile.value || trainingKnowledgeUploadResult.value))
const trainingKnowledgeUploadQualityReport = computed(() => trainingKnowledgeUploadResult.value?.quality_report || {})
const trainingKnowledgeUploadQualityWarnings = computed(() => safeList(trainingKnowledgeUploadQualityReport.value.warnings))
const trainingKnowledgeUploadQualityMetrics = computed(() => (trainingKnowledgeUploadQualityReport.value.metrics || {}) as Record<string, unknown>)
const trainingKnowledgeUploadQualitySplitText = computed(() => {
  const splitter = String(trainingKnowledgeUploadQualityReport.value.selected_splitter || '')
  if (splitter === 'llm_fallback') return 'LLM 兜底切分'
  if (trainingKnowledgeUploadQualityReport.value.llm_fallback_attempted) return '规则切分，已尝试 LLM 兜底'
  return '规则配置切分'
})
const trainingKnowledgeUploadPublishValidation = computed(() => (
  trainingKnowledgeUploadQualityReport.value.publish_validation || null
) as Record<string, unknown> | null)
const trainingKnowledgeChunkTypeSummaries = computed<ChunkTypeSummary[]>(() => {
  const summaryMap = new Map<string, ChunkTypeSummary>()
  for (const chunk of trainingKnowledgeChunks.value) {
    const label = trainingKnowledgeCasePartLabel(chunk.case_part)
    const usageLabel = trainingKnowledgeChunkUsageLabel(chunk.visibility)
    const current = summaryMap.get(chunk.case_part)
    if (current) {
      current.count += 1
      if (!current.usageLabels.includes(usageLabel)) {
        current.usageLabels.push(usageLabel)
      }
      continue
    }
    summaryMap.set(chunk.case_part, {
      casePart: chunk.case_part,
      label,
      count: 1,
      usageLabels: [usageLabel],
      sampleText: chunk.chunk_text,
    })
  }
  return Array.from(summaryMap.values())
})
const trainingKnowledgeActiveChunkTypeChunks = computed(() => {
  const summary = trainingKnowledgeActiveChunkSummary.value
  if (!summary) return []
  return trainingKnowledgeChunks.value.filter((chunk) => chunk.case_part === summary.casePart)
})
const trainingKnowledgeUploadHelpDescription = computed(() => (
  '训练资料上传只负责文件入库、去重、待发布切片和发布，不在上传阶段配置画像、行业、难度和评分规则。'
))

const salesTrainingStats = computed(() => [
  { label: '训练资料', value: trainingBatchTotal.value, detail: `${trainingPublishedBatchCount.value} 已发布 / ${trainingPendingBatchCount.value} 待处理`, icon: DatabaseZap, tone: 'cyan' },
  { label: '陪练方案', value: trainingPlanTotal.value, detail: `${trainingPlanReadyCount.value} 已就绪 / ${trainingPlanStaleCount.value} 待重生成`, icon: Target, tone: 'violet' },
  { label: '训练会话', value: trainingSessionTotal.value, detail: `${trainingActiveSessionCount.value} 进行中 / ${trainingScoringSessionCount.value} 待评分`, icon: MessageSquareText, tone: 'amber' },
  { label: '正式向量', value: trainingVectorPoints.value, detail: `临时预览 ${trainingStagingVectorPoints.value} 点`, icon: BrainCircuit, tone: 'blue' },
])

const trainingTimeline = computed(() => [
  {
    title: '资料准备',
    detail: trainingPublishedBatchCount.value > 0 ? `${trainingPublishedBatchCount.value} 批资料可用于生成客户角色` : '还没有已发布训练资料',
    status: trainingPublishedBatchCount.value > 0 ? 'ready' : 'todo',
  },
  {
    title: '角色方案',
    detail: latestTrainingPlan.value ? `${latestTrainingPlan.value.plan_name} · ${latestTrainingPlan.value.trainee_name}` : '等待创建训练方案',
    status: trainingPlanReadyCount.value > 0 ? 'ready' : 'todo',
  },
  {
    title: '实战会话',
    detail: latestTrainingSession.value ? `${trainingSessionLabel(latestTrainingSession.value.status)} · ${latestTrainingSession.value.answered_count}/${latestTrainingSession.value.round_limit} 轮` : '暂无训练会话',
    status: trainingActiveSessionCount.value > 0 ? 'active' : trainingCompletedSessionCount.value > 0 ? 'ready' : 'todo',
  },
])

const collectionOptions = computed(() => { // 汇总通用知识库 collection，训练资料 collection 只在“销售训练资料”页签展示
  const names = new Set<string>()
  const defaultCollectionName = health.value?.collection_name || 'agent'
  if (!isTrainingCollection(defaultCollectionName)) {
    names.add(defaultCollectionName)
  }
  for (const collectionName of health.value?.collections || []) {
    if (collectionName && !isTrainingCollection(collectionName)) names.add(collectionName)
  }
  for (const file of knowledgeFiles.value) {
    if (file.collection_name && !isTrainingCollection(file.collection_name)) names.add(file.collection_name)
  }
  if (!names.size) names.add('agent')
  return Array.from(names).sort((left, right) => left.localeCompare(right))
})

const knowledgeFilesInActiveCollection = computed(() => { // 先按当前 collection 页签过滤知识库文件
  if (!activeKnowledgeCollection.value) return knowledgeFiles.value
  return knowledgeFiles.value.filter((file) => file.collection_name === activeKnowledgeCollection.value)
})

const filteredKnowledgeFiles = computed(() => { // 再按文件名关键词过滤知识库文件
  const keyword = knowledgeKeyword.value.trim().toLowerCase()
  if (!keyword) return knowledgeFilesInActiveCollection.value
  return knowledgeFilesInActiveCollection.value.filter((file) => file.filename.toLowerCase().includes(keyword))
})

const pagedKnowledgeFiles = computed(() => { // 当前页展示的 9 个知识库文件
  const start = (knowledgePage.value - 1) * knowledgePageSize
  return filteredKnowledgeFiles.value.slice(start, start + knowledgePageSize)
})

const activeIndexedKnowledgeCount = computed(() => ( // 当前 collection 下已经索引成功的文件数
  knowledgeFilesInActiveCollection.value.filter((file) => file.status === 'indexed').length
))

const knowledgeCollectionTabs = computed(() => ( // 知识库弹窗页签统计
  collectionOptions.value.map((collectionName) => {
    const files = knowledgeFiles.value.filter((file) => file.collection_name === collectionName)
    return {
      collectionName,
      total: files.length,
      indexed: files.filter((file) => file.status === 'indexed').length,
      points: Number(health.value?.collection_points?.[collectionName] || 0),
    }
  })
))

const overviewPagedConversations = computed(() => { // 首页最近会话当前页数据
  const start = (overviewConversationPage.value - 1) * overviewConversationPageSize
  return conversations.value.slice(start, start + overviewConversationPageSize)
})

const overviewPagedExamSessions = computed(() => { // 首页考试记录当前页数据
  const start = (overviewExamSessionPage.value - 1) * overviewExamSessionPageSize
  return examSessions.value.slice(start, start + overviewExamSessionPageSize)
})

const overviewPagedTrainingSessions = computed(() => { // 首页最近训练当前页数据
  const start = (overviewTrainingSessionPage.value - 1) * overviewSalesCardPageSize
  return trainingSessions.value.slice(start, start + overviewSalesCardPageSize)
})

const overviewPagedTrainingBatches = computed(() => { // 首页训练资料当前页数据
  const start = (overviewTrainingBatchPage.value - 1) * overviewSalesCardPageSize
  return trainingBatches.value.slice(start, start + overviewSalesCardPageSize)
})

const pagedDictionaryGroups = computed(() => { // 父级字典分页结果
  const start = (dictionaryPage.value - 1) * dictionaryPageSize
  return dictionaries.value.slice(start, start + dictionaryPageSize)
})

const activeDictionaryGroup = computed(() => ( // 当前正在查看详情的父级字典
  dictionaries.value.find((group) => group.dictionary_code === activeDictionaryCode.value) || null
))

watch(knowledgeKeyword, () => { // 搜索条件变化时回到知识库第一页
  knowledgePage.value = 1
})

watch(activeKnowledgeCollection, () => { // 切换 collection 时回到知识库第一页
  knowledgePage.value = 1
})

watch(collectionOptions, (collections) => { // 确保知识库弹窗始终选中一个有效 collection
  if (!collections.length) {
    activeKnowledgeCollection.value = ''
    return
  }
  if (!activeKnowledgeCollection.value || !collections.includes(activeKnowledgeCollection.value)) {
    activeKnowledgeCollection.value = collections[0]
  }
}, { immediate: true })

watch(conversations, (items) => { // 会话刷新后修正首页最近会话页码
  const maxPage = Math.max(1, Math.ceil(items.length / overviewConversationPageSize))
  overviewConversationPage.value = Math.min(overviewConversationPage.value, maxPage)
})

watch(examSessions, (items) => { // 考试记录刷新后修正首页考试记录页码
  const maxPage = Math.max(1, Math.ceil(items.length / overviewExamSessionPageSize))
  overviewExamSessionPage.value = Math.min(overviewExamSessionPage.value, maxPage)
})

watch(trainingSessions, (items) => { // 训练会话刷新后修正首页最近训练页码
  const maxPage = Math.max(1, Math.ceil(items.length / overviewSalesCardPageSize))
  overviewTrainingSessionPage.value = Math.min(overviewTrainingSessionPage.value, maxPage)
})

watch(trainingBatches, (items) => { // 训练资料刷新后修正首页资料分页页码
  const maxPage = Math.max(1, Math.ceil(items.length / overviewSalesCardPageSize))
  overviewTrainingBatchPage.value = Math.min(overviewTrainingBatchPage.value, maxPage)
})

watch(dictionaries, () => { // 字典刷新后修正详情页和分页状态
  if (activeDictionaryCode.value && !dictionaries.value.some((group) => group.dictionary_code === activeDictionaryCode.value)) {
    activeDictionaryCode.value = ''
  }
  const maxPage = Math.max(1, Math.ceil(dictionaries.value.length / dictionaryPageSize))
  dictionaryPage.value = Math.min(dictionaryPage.value, maxPage)
})

function flattenDictionaryItems(items: DictionaryItemResponse[]): DictionaryItemResponse[] { // 把多层级字典项拉平成列表
  return items.flatMap((item) => [item, ...flattenDictionaryItems(item.children || [])])
}

function dictionaryItems(dictionaryCode: string) { // 按字典编码读取启用字典项
  const group = dictionaries.value.find((item) => item.dictionary_code === dictionaryCode)
  return flattenDictionaryItems(group?.items || []).filter((item) => item.enabled)
}

function dictionaryDefaultCode(dictionaryCode: string) { // 获取某组字典默认项，默认取排序最靠前的启用项
  return dictionaryItems(dictionaryCode)[0]?.item_code || ''
}

function dictionaryCodeByMetadata(dictionaryCode: string, key: string, value: unknown) { // 按 metadata 查找具有业务含义的字典项编码
  return dictionaryItems(dictionaryCode).find((item) => item.metadata?.[key] === value)?.item_code || ''
}

function dictionaryGroupItemCount(group: DictionaryGroupResponse) { // 统计单个父级字典下的全部字典项数量
  return flattenDictionaryItems(group.items).length
}

function trainingStatusKind(status: string) { // 把训练资料批次状态归类成首页容易读懂的状态组
  if (['published', 'indexed', 'active'].includes(status)) return 'published'
  if (['parsing', 'parsed', 'pending_review', 'reviewing', 'staged'].includes(status)) return 'pending'
  if (['parsing_failed', 'failed', 'rejected'].includes(status)) return 'failed'
  return 'other'
}

function trainingBatchLabel(status: string) { // 训练资料状态中文文案
  if (trainingStatusKind(status) === 'published') return '已发布'
  if (trainingStatusKind(status) === 'pending') return '待处理'
  if (trainingStatusKind(status) === 'failed') return '异常'
  return status || '未知'
}

function trainingSessionLabel(status: string) { // 训练会话状态中文文案
  if (status === 'active') return '进行中'
  if (status === 'scoring') return '待评分'
  if (status === 'completed') return '已完成'
  return status || '未知'
}

function trainingKnowledgeDictionaryItemLabel(dictionaryCode: string, code: string, fallbackLabels: Record<string, string>) {
  const item = dictionaryItems(dictionaryCode).find((option) => option.item_code === code)
  return item?.item_name || fallbackLabels[code] || code
}

function trainingKnowledgeDictionaryItemDescription(dictionaryCode: string, code: string) {
  return dictionaryItems(dictionaryCode).find((option) => option.item_code === code)?.description || ''
}

function trainingKnowledgeCasePartLabel(code: string) { // 训练资料切片类型中文文案
  return trainingKnowledgeDictionaryItemLabel('training_case_part', code, {
    case_profile: '客户背景',
    task_requirement: '训练任务',
    standard_answer: '参考话术',
    hidden_psychology: '客户顾虑',
    scoring_rubric: '评分依据',
    product_fact: '产品事实',
    faq: '常见问答',
    competitor: '竞品信息',
    success_case: '成功案例',
    glossary: '术语说明',
  })
}

function trainingKnowledgeChunkUsageLabel(code: string) { // 训练资料切片用途中文文案
  return trainingKnowledgeDictionaryItemLabel('training_chunk_usage', code, {
    visible: '通用知识',
    hidden: '客户内部顾虑',
    scoring_only: '评分专用',
  })
}

function trainingKnowledgeBatchStatusLabel(code: string) { // 训练资料批次状态中文文案
  return trainingKnowledgeDictionaryItemLabel('training_batch_status', code, {
    waiting: '等待上传',
    parsing: '解析中',
    pending_review: '待确认',
    embedding: '发布中',
    published: '已发布',
    archived: '历史版本',
    parsing_failed: '解析失败',
    publish_failed: '发布失败',
    deleted: '已删除',
    duplicated: '重复复用',
  })
}

function trainingKnowledgeQualityLevelLabel(level: unknown) { // 训练资料质量等级中文文案
  return displayOptionLabel(String(level || ''), {
    good: '质量较好',
    review: '建议复核',
    poor: '质量较低',
  })
}

function trainingKnowledgeQualityLevelClass(level: unknown) { // 训练资料质量等级对应的样式类
  const value = String(level || '')
  if (value === 'good') return 'good'
  if (value === 'poor') return 'poor'
  return 'review'
}

function trainingKnowledgeChunkSummaryTitle(summary: ChunkTypeSummary) {
  const partDescription = trainingKnowledgeDictionaryItemDescription('training_case_part', summary.casePart)
  return [
    `切片类型编码：${summary.casePart}`,
    partDescription && `类型说明：${partDescription}`,
    `包含分片：${summary.count} 条`,
    `模型用途：${summary.usageLabels.join('、')}`,
  ].filter(Boolean).join('\n')
}

function trainingKnowledgeChunkDetailMeta(chunk: TrainingKnowledgeChunkResponse, index: number) {
  const metadata = chunk.metadata || {}
  const pageNumbers = valueList(metadata.page_numbers).join('、')
  const headingLevels = valueList(metadata.heading_levels).join('、')
  const outlineTitles = valueList(metadata.outline_titles).join(' / ')
  const splitter = String(metadata.splitter || '').trim()
  const blockRange = [metadata.start_block_index, metadata.end_block_index]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join('-')
  return [
    `第 ${index + 1} 条`,
    `用途：${trainingKnowledgeChunkUsageLabel(chunk.visibility)}`,
    metadata.source_file ? `来源：${metadata.source_file}` : '',
    metadata.task_id ? `任务：${metadata.task_id}` : '',
    metadata.section_title ? `标题：${metadata.section_title}` : '',
    pageNumbers ? `页码：${pageNumbers}` : '',
    blockRange ? `段落：${blockRange}` : '',
    headingLevels ? `标题级别：${headingLevels}` : '',
    outlineTitles ? `目录：${outlineTitles}` : '',
    splitter ? `切分：${splitter}` : '',
  ].filter(Boolean).join(' · ')
}

function openSalesTraining() { // 从首页驾驶舱跳到销售陪练主页面
  emit('openSalesTraining')
}

function knowledgeStatusType(status: string) { // 把知识库文件状态转换成 Element Plus 标签类型
  const item = dictionaryItems('document_status').find((option) => option.item_code === status)
  return String(item?.metadata?.tag_type || 'info')
}

function isKnowledgeResultStatus(status: string, metadataKey: string, metadataValue: unknown) { // 判断知识库操作结果是否匹配某个字典元数据
  const targetCode = dictionaryCodeByMetadata('knowledge_result_status', metadataKey, metadataValue)
  return Boolean(targetCode) && status === targetCode
}

function formatFileSize(size: number) { // 把字节数格式化成页面易读文本
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(value?: string | null) { // 格式化后端 ISO 时间
  if (!value) return '暂无'
  return value.replace('T', ' ').slice(0, 19)
}

function conversationFallbackTitle(conversation: ConversationSummaryResponse) {
  return conversation.title || '未命名会话'
}

function conversationTooltipContent(conversation: ConversationSummaryResponse) {
  return conversationTooltipMap.value[conversation.conversation_id] || conversationFallbackTitle(conversation)
}

function openConversationHistory(conversation: ConversationSummaryResponse) {
  emit('openChatHistory', conversation.conversation_id)
  recentConversationDialogVisible.value = false
}

function openRecentConversationDialog() {
  // 首页顶部入口只负责打开会话弹窗，数据仍由 refreshDashboard 统一刷新。
  recentConversationDialogVisible.value = true
}

function openExamRecordDialog() { // 打开首页考试记录弹窗
  examRecordDialogVisible.value = true
}

function examRecordSourceText(session: ExamSessionSummary) { // 展示考试记录题源
  return [session.filename || session.collection_name, session.section_path].filter(Boolean).join(' / ') || '题源'
}

async function openExamDetail(session: ExamSessionSummary) { // 打开考试详情弹窗
  examDetailVisible.value = true
  examDetailLoading.value = true
  selectedExamDetail.value = null
  try {
    selectedExamDetail.value = await getExamSessionDetail(session.session_id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '考试详情加载失败')
    examDetailVisible.value = false
  } finally {
    examDetailLoading.value = false
  }
}

async function handleDeleteExamSession(session: ExamSessionSummary) { // 删除首页考试记录
  const confirmed = await confirmDangerOnce(
    `确认删除《${session.title}》吗？删除后考试题目和作答明细都会移除。`,
    '删除考试记录',
  )
  if (!confirmed) return

  examDeletingId.value = session.session_id
  try {
    await deleteExamSession(session.session_id)
    if (selectedExamDetail.value?.session.session_id === session.session_id) {
      selectedExamDetail.value = null
      examDetailVisible.value = false
    }
    ElMessage.success('考试记录已删除')
    await refreshDashboard()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '考试记录删除失败')
  } finally {
    examDeletingId.value = ''
  }
}

async function loadConversationTooltip(conversation: ConversationSummaryResponse) {
  if (conversationTooltipMap.value[conversation.conversation_id]) return
  try {
    const detail = await getConversationDetail(conversation.conversation_id)
    const userMessage = detail.messages.find((message) => message.role === 'user' && message.content.trim())
    conversationTooltipMap.value[conversation.conversation_id] = userMessage?.content.trim() || conversationFallbackTitle(conversation)
  } catch {
    conversationTooltipMap.value[conversation.conversation_id] = conversationFallbackTitle(conversation)
  }
}

function knowledgeActionKey(action: string, documentId: string) { // 拼接知识库文件操作唯一 key
  return `${action}:${documentId}`
}

function dictionaryActionKey(action: string, dictionaryItemId: string) { // 拼接字典项操作唯一 key
  return `${action}:${dictionaryItemId}`
}

async function confirmDangerOnce(message: string, title: string, confirmButtonText = '确认删除') { // 删除和重建类操作统一确认
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText,
      cancelButtonText: '取消',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

async function refreshDashboard() { // 刷新首页所有总览数据
  loading.value = true
  // 首页只做总览展示，单个接口变慢或失败时不应该阻塞整页渲染。
  const [
    healthResult,
    filesResult,
    dictionaryResult,
    conversationResult,
    examSessionResult,
    trainingBatchResult,
    trainingPlanResult,
    trainingSessionResult,
  ] = await Promise.allSettled([
    fetchHealth(),
    listKnowledgeFiles(),
    listDictionaries(),
    listConversations(1, 30),
    listExamSessions(1, 30, 'exam-user'),
    listTrainingKnowledgeBatches(1, 30),
    listTrainingPlans(1, 8),
    listTrainingSessions(1, 30),
  ])

  try {
    if (healthResult.status === 'fulfilled') {
      health.value = healthResult.value
      selectedUploadCollection.value ||= healthResult.value.collection_name || 'agent'
    }
    if (filesResult.status === 'fulfilled') {
      knowledgeFiles.value = filesResult.value
    }
    if (dictionaryResult.status === 'fulfilled') {
      dictionaries.value = dictionaryResult.value
      selectedDocumentType.value ||= dictionaryDefaultCode('document_structure')
      selectedSplitStrategy.value ||= dictionaryDefaultCode('split_strategy')
    }
    if (conversationResult.status === 'fulfilled') {
      conversations.value = conversationResult.value.items
      conversationTotal.value = conversationResult.value.total
    }
    if (examSessionResult.status === 'fulfilled') {
      examSessions.value = examSessionResult.value.items
      examSessionTotal.value = examSessionResult.value.total
    }
    if (trainingBatchResult.status === 'fulfilled') {
      trainingBatches.value = trainingBatchResult.value.items
      trainingBatchTotal.value = trainingBatchResult.value.total
    }
    if (trainingPlanResult.status === 'fulfilled') {
      trainingPlans.value = trainingPlanResult.value.items
      trainingPlanTotal.value = trainingPlanResult.value.total
    }
    if (trainingSessionResult.status === 'fulfilled') {
      trainingSessions.value = trainingSessionResult.value.items
      trainingSessionTotal.value = trainingSessionResult.value.total
    }

    const failedCount = [
      healthResult,
      filesResult,
      dictionaryResult,
      conversationResult,
      examSessionResult,
      trainingBatchResult,
      trainingPlanResult,
      trainingSessionResult,
    ]
      .filter((result) => result.status === 'rejected')
      .length
    if (failedCount > 0) {
      ElMessage.warning(`首页有 ${failedCount} 个数据接口加载失败，已先展示可用数据`)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '首页数据刷新失败')
  } finally {
    loading.value = false
  }
}

async function refreshKnowledgeFiles() { // 刷新知识库文件列表
  knowledgeLoading.value = true
  try {
    knowledgeFiles.value = await listKnowledgeFiles()
    const maxPage = Math.max(1, Math.ceil(filteredKnowledgeFiles.value.length / knowledgePageSize))
    knowledgePage.value = Math.min(knowledgePage.value, maxPage)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识库文件列表加载失败')
  } finally {
    knowledgeLoading.value = false
  }
}

async function refreshDictionaries() { // 刷新字典表并同步上传配置默认值
  dictionaryLoading.value = true
  try {
    dictionaries.value = await listDictionaries()
    selectedDocumentType.value ||= dictionaryDefaultCode('document_structure')
    selectedSplitStrategy.value ||= dictionaryDefaultCode('split_strategy')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典表加载失败')
  } finally {
    dictionaryLoading.value = false
  }
}

async function refreshHealth() { // 刷新后端健康检查
  try {
    health.value = await fetchHealth()
  } catch {
    health.value = {
      status: 'degraded',
      qdrant: 'unavailable',
      collection_name: 'agent',
      collections: [],
      collection_points: {},
    }
  }
}

async function openKnowledgeDialog() { // 打开首页知识库弹窗，同时刷新通用知识库和销售训练资料概览
  knowledgeDialogVisible.value = true
  knowledgeDialogTab.value = 'general'
  await Promise.all([refreshKnowledgeFiles(), refreshTrainingKnowledgeBatches()])
}

function openKnowledgeFilePicker() { // 触发隐藏文件输入框，保持上传按钮样式统一
  knowledgeFileInput.value?.click()
}

async function openDictionaryDialog() { // 打开字典表弹窗，并刷新最新字典配置
  dictionaryDialogVisible.value = true
  await refreshDictionaries()
}

async function openTrainingKnowledgeDialog() { // 从首页销售驾驶舱直接打开“销售训练资料”管理页签
  knowledgeDialogVisible.value = true
  knowledgeDialogTab.value = 'salesTraining'
  await Promise.all([refreshKnowledgeFiles(), refreshTrainingKnowledgeBatches()])
}

async function handleKnowledgeFileChange(event: Event) { // 选择文件后先上传到临时区做预解析
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingKnowledge.value = true
  try {
    const response = await previewKnowledgeFile(file)
    if (response.duplicate) {
      ElMessage.info('当前已有相同内容文件，也可以选择新 Collection 后继续入库')
    }
    uploadPreview.value = response
    uploadRecommendation.value = null
    selectedDocumentType.value = response.detected_type
    selectedSplitStrategy.value = response.split_strategy
    selectedUploadCollection.value = activeKnowledgeCollection.value || health.value?.collection_name || 'agent'
    uploadPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件预解析失败')
  } finally {
    uploadingKnowledge.value = false
    target.value = ''
  }
}

async function handleRecommendKnowledgeUpload() { // 调用模型推荐上传文件的结构和切分策略
  if (!uploadPreview.value || recommendingKnowledge.value) return

  recommendingKnowledge.value = true
  try {
    const recommendation = await recommendKnowledgeUpload(uploadPreview.value.upload_id)
    uploadRecommendation.value = recommendation
    selectedDocumentType.value = recommendation.document_type
    selectedSplitStrategy.value = recommendation.split_strategy
    ElMessage.success('已采用模型推荐的切分方式')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '模型推荐失败')
  } finally {
    recommendingKnowledge.value = false
  }
}

async function handleConfirmKnowledgeUpload() { // 用户确认后把临时上传文件正式写入知识库
  if (!uploadPreview.value || confirmingKnowledge.value) return

  confirmingKnowledge.value = true
  try {
    const response = await confirmKnowledgeUpload(
      uploadPreview.value.upload_id,
      selectedDocumentType.value,
      selectedSplitStrategy.value,
      selectedUploadCollection.value,
    )
    if (isKnowledgeResultStatus(response.status, 'result_kind', 'duplicate')) {
      ElMessage.info(response.message || '相同内容的文件已经存在')
    } else {
      ElMessage.success(response.message || '文件已写入知识库')
    }
    uploadPreviewVisible.value = false
    uploadPreview.value = null
    uploadRecommendation.value = null
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件入库失败')
  } finally {
    confirmingKnowledge.value = false
  }
}

function onTrainingKnowledgeFileChange(file: File | undefined) { // 选择训练资料文件后，仅缓存 File 对象，不立即写入向量库
  trainingKnowledgeSelectedFile.value = file || null
  trainingKnowledgeUploadResult.value = null
}

function clearTrainingKnowledgeUploadArea() { // 清空训练资料上传区，避免误把上一次文件重复提交
  trainingKnowledgeSelectedFile.value = null
  trainingKnowledgeUploadResult.value = null
}

async function uploadTrainingKnowledgeFile() { // 上传销售训练资料，后端负责保存原文件、MD5 去重、切片和质量评估
  if (!trainingKnowledgeSelectedFile.value) {
    ElMessage.warning('请先选择 LMS 案例文件')
    return
  }

  trainingKnowledgeUploading.value = true
  try {
    trainingKnowledgeUploadResult.value = await uploadTrainingKnowledge({
      file: trainingKnowledgeSelectedFile.value,
      sourceType: 'lms_case',
      modelMode: 'high',
    })
    const response = await listTrainingKnowledgeChunks(trainingKnowledgeUploadResult.value.batch_id)
    trainingKnowledgeChunks.value = response.chunks
    trainingKnowledgeActiveBatchId.value = trainingKnowledgeUploadResult.value.batch_id
    await refreshTrainingKnowledgeBatches()
    ElMessage.success(trainingKnowledgeUploadResult.value.duplicate_of ? '资料已存在，已复用历史入库批次' : '训练资料切片已生成，请确认后发布')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练知识上传失败')
  } finally {
    trainingKnowledgeUploading.value = false
  }
}

async function publishTrainingKnowledgeFileBatch(batchId: string) { // 人工确认发布后，后端把临时向量复制到正式训练向量库
  trainingKnowledgePublishingBatchId.value = batchId
  try {
    const result = await publishTrainingKnowledgeBatch(batchId)
    if (trainingKnowledgeUploadResult.value?.batch_id === batchId) {
      trainingKnowledgeUploadResult.value = {
        ...trainingKnowledgeUploadResult.value,
        status: result.status,
        chunk_count: result.chunk_count,
        point_count: result.point_count,
        quality_report: result.quality_report,
      }
    }
    await refreshTrainingKnowledgeBatches()
    const response = await listTrainingKnowledgeChunks(batchId)
    trainingKnowledgeChunks.value = response.chunks
    trainingKnowledgeActiveBatchId.value = batchId
    if (trainingKnowledgeVersionDialogVisible.value) {
      await loadTrainingKnowledgeBatchVersions(batchId)
    }
    await refreshHealth()
    ElMessage.success('训练资料已发布并写入向量库')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料发布失败')
  } finally {
    trainingKnowledgePublishingBatchId.value = ''
  }
}

async function rollbackTrainingKnowledgeFileBatch(batch: TrainingKnowledgeBatchResponse) { // 回滚历史版本并刷新当前切片
  const confirmed = await confirmDangerOnce(
    `确定回滚到「${batch.source_file}」的 V${batch.version_no || 1} 吗？当前版本会变成历史版本。`,
    '回滚训练资料版本',
    '确认回滚',
  )
  if (!confirmed) return

  trainingKnowledgeRollingBackBatchId.value = batch.batch_id
  try {
    const result = await rollbackTrainingKnowledgeBatch(batch.batch_id)
    if (trainingKnowledgeUploadResult.value?.batch_id === batch.batch_id) {
      trainingKnowledgeUploadResult.value = {
        ...trainingKnowledgeUploadResult.value,
        status: result.status,
        chunk_count: result.chunk_count,
        point_count: result.point_count,
        quality_report: result.quality_report,
      }
    }
    await refreshTrainingKnowledgeBatches()
    const response = await listTrainingKnowledgeChunks(batch.batch_id)
    trainingKnowledgeChunks.value = response.chunks
    trainingKnowledgeActiveBatchId.value = batch.batch_id
    if (trainingKnowledgeVersionDialogVisible.value) {
      await loadTrainingKnowledgeBatchVersions(batch.batch_id)
    }
    ElMessage.success(`已回滚到 V${result.version_no}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料回滚失败')
  } finally {
    trainingKnowledgeRollingBackBatchId.value = ''
  }
}

async function reparseTrainingKnowledgeFileBatch(batch: TrainingKnowledgeBatchResponse | string) { // 对未发布资料重新执行 LLM 兜底切分
  const batchId = typeof batch === 'string' ? batch : batch.batch_id
  const sourceFile = typeof batch === 'string' ? trainingKnowledgeUploadResult.value?.source_file || '当前资料' : batch.source_file
  const confirmed = await confirmDangerOnce(
    `确定使用 LLM 重新切分「${sourceFile}」吗？重切后需要再次人工确认发布。`,
    'LLM 重新切分',
    '确认重切',
  )
  if (!confirmed) return

  trainingKnowledgeReparsingBatchId.value = batchId
  try {
    const result = await reparseTrainingKnowledgeBatch(batchId, true, 'high')
    if (trainingKnowledgeUploadResult.value?.batch_id === batchId) {
      trainingKnowledgeUploadResult.value = {
        ...trainingKnowledgeUploadResult.value,
        status: result.status,
        chunk_count: result.chunk_count,
        point_count: result.point_count,
        source_file: result.source_file ?? trainingKnowledgeUploadResult.value.source_file,
        quality_report: result.quality_report,
      }
    }
    await refreshTrainingKnowledgeBatches()
    const response = await listTrainingKnowledgeChunks(batchId)
    trainingKnowledgeChunks.value = response.chunks
    trainingKnowledgeActiveBatchId.value = batchId
    if (trainingKnowledgeVersionDialogVisible.value) {
      await loadTrainingKnowledgeBatchVersions(batchId)
    }
    ElMessage.success('LLM 重新切分完成，请检查切片后再发布')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料重新切分失败')
  } finally {
    trainingKnowledgeReparsingBatchId.value = ''
  }
}

async function loadTrainingKnowledgeBatchVersions(batchId: string) { // 读取同一份训练资料的版本链
  trainingKnowledgeVersionLoading.value = true
  try {
    const response = await listTrainingKnowledgeBatchVersions(batchId)
    trainingKnowledgeActiveVersionGroupId.value = response.version_group_id
    trainingKnowledgeBatchVersions.value = response.items
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料版本链读取失败')
  } finally {
    trainingKnowledgeVersionLoading.value = false
  }
}

async function openTrainingKnowledgeBatchVersions(batch: TrainingKnowledgeBatchResponse) { // 打开训练资料版本链弹窗
  trainingKnowledgeVersionDialogVisible.value = true
  await loadTrainingKnowledgeBatchVersions(batch.batch_id)
}

async function refreshTrainingKnowledgeBatches() { // 刷新首页弹窗内的销售训练资料批次列表
  trainingKnowledgeLoadingBatches.value = true
  try {
    const response = await listTrainingKnowledgeBatches(trainingKnowledgeBatchPage.value, 9)
    if (response.items.length === 0 && response.total > 0 && trainingKnowledgeBatchPage.value > 1) {
      trainingKnowledgeBatchPage.value -= 1
      await refreshTrainingKnowledgeBatches()
      return
    }
    const sortedItems = sortTrainingBatchesByImportTime(response.items)
    trainingBatches.value = sortedItems
    trainingBatchTotal.value = response.total
    trainingKnowledgeBatchTotal.value = response.total
    if (
      trainingKnowledgeActiveBatchId.value
      && !sortedItems.some((item) => item.batch_id === trainingKnowledgeActiveBatchId.value)
    ) {
      trainingKnowledgeActiveBatchId.value = ''
      trainingKnowledgeChunks.value = []
      trainingKnowledgeActiveChunkSummary.value = null
    }
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '训练资料列表读取失败')
  } finally {
    trainingKnowledgeLoadingBatches.value = false
  }
}

async function openTrainingKnowledgeBatch(batch: TrainingKnowledgeBatchResponse) { // 点击训练资料批次时加载其切片结构
  trainingKnowledgeActiveBatchId.value = batch.batch_id
  trainingKnowledgeChunkStructureVisible.value = true
  trainingKnowledgeLoadingChunks.value = true
  try {
    const response = await listTrainingKnowledgeChunks(batch.batch_id)
    trainingKnowledgeChunks.value = response.chunks
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料切片读取失败')
  } finally {
    trainingKnowledgeLoadingChunks.value = false
  }
}

function closeTrainingKnowledgeChunkStructure() { // 关闭训练资料切片结构弹窗时释放当前批次状态
  trainingKnowledgeChunkStructureVisible.value = false
  trainingKnowledgeActiveBatchId.value = ''
  trainingKnowledgeChunks.value = []
  trainingKnowledgeActiveChunkSummary.value = null
  trainingKnowledgeChunkDetailVisible.value = false
}

async function previewTrainingKnowledgeFileBatch(batch: TrainingKnowledgeBatchResponse) { // 预览 MinIO 中保存的训练资料上传原文件
  trainingKnowledgePreviewingBatchId.value = batch.batch_id
  trainingKnowledgePreviewVisible.value = true
  trainingKnowledgePreviewLoading.value = true
  trainingKnowledgePreview.value = null
  try {
    trainingKnowledgePreview.value = await previewTrainingKnowledgeBatch(batch.batch_id)
  } catch (error) {
    trainingKnowledgePreviewVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '预览失败')
  } finally {
    trainingKnowledgePreviewLoading.value = false
    trainingKnowledgePreviewingBatchId.value = ''
  }
}

async function deleteTrainingKnowledgeFileBatch(batch: TrainingKnowledgeBatchResponse) { // 删除训练资料批次和对应向量点
  const confirmed = await confirmDangerOnce(
    `确定删除训练资料「${batch.source_file}」吗？删除后会移除对应向量点。`,
    '删除训练资料',
    '确认删除',
  )
  if (!confirmed) return

  trainingKnowledgeDeletingBatchId.value = batch.batch_id
  try {
    await deleteTrainingKnowledgeBatch(batch.batch_id)
    ElMessage.success('训练资料已删除')
    if (trainingKnowledgeActiveBatchId.value === batch.batch_id) {
      trainingKnowledgeActiveBatchId.value = ''
      trainingKnowledgeChunks.value = []
    }
    await refreshTrainingKnowledgeBatches()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料删除失败')
  } finally {
    trainingKnowledgeDeletingBatchId.value = ''
  }
}

function openTrainingKnowledgeChunkSummary(summary: ChunkTypeSummary) { // 打开某类训练知识切片详情
  trainingKnowledgeActiveChunkSummary.value = summary
  trainingKnowledgeChunkDetailVisible.value = true
}

async function handlePreviewKnowledgeFile(file: KnowledgeFileResponse) { // 打开单个知识库文件预览
  const actionKey = knowledgeActionKey('preview', file.document_id)
  knowledgePreviewVisible.value = true
  knowledgePreviewLoading.value = true
  knowledgePreview.value = null
  activeKnowledgeAction.value = actionKey

  try {
    knowledgePreview.value = await previewKnowledgeDocument(file.document_id)
  } catch (error) {
    knowledgePreviewVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '文件预览失败')
  } finally {
    knowledgePreviewLoading.value = false
    if (activeKnowledgeAction.value === actionKey) {
      activeKnowledgeAction.value = ''
    }
  }
}

async function handleReindexKnowledgeFile(file: KnowledgeFileResponse) { // 重新索引单个知识库文件
  const confirmed = await confirmDangerOnce(`确定重新索引「${file.filename}」吗？`, '重新索引', '重新索引')
  if (!confirmed) return

  activeKnowledgeAction.value = knowledgeActionKey('reindex', file.document_id)
  try {
    await reindexKnowledgeFile(file.document_id)
    ElMessage.success('已重新索引')
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新索引失败')
  } finally {
    activeKnowledgeAction.value = ''
  }
}

async function handleReindexAllKnowledgeFiles() { // 清空旧向量并重新索引全部知识库文件
  const confirmed = await confirmDangerOnce(
    '确定清空旧向量并重新索引全部知识库文件吗？这个操作会重新生成向量，文件多时会比较慢。',
    '清空并重建',
    '清空并重建',
  )
  if (!confirmed) return

  reindexingAll.value = true
  try {
    const response = await reindexAllKnowledgeFiles()
    if (response.failed > 0) {
      ElMessage.warning(`重建完成：成功 ${response.succeeded} 个，失败 ${response.failed} 个`)
    } else {
      ElMessage.success(`全部重建完成：${response.succeeded} 个文件`)
    }
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清空并重建失败')
  } finally {
    reindexingAll.value = false
  }
}

async function handleDeleteKnowledgeFile(file: KnowledgeFileResponse) { // 删除单个知识库文件
  const confirmed = await confirmDangerOnce(`确定删除「${file.filename}」吗？`, '删除知识库文件', '删除')
  if (!confirmed) return

  activeKnowledgeAction.value = knowledgeActionKey('delete', file.document_id)
  try {
    await deleteKnowledgeFile(file.document_id)
    ElMessage.success('已删除知识库文件')
    await refreshKnowledgeFiles()
    await refreshHealth()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    activeKnowledgeAction.value = ''
  }
}

function openDictionaryGroup(group: DictionaryGroupResponse) { // 进入父级字典详情
  activeDictionaryCode.value = group.dictionary_code
}

function backToDictionaryGroups() { // 返回父级字典列表
  activeDictionaryCode.value = ''
}

function handleDictionaryPageChange(page: number) { // 父级字典分页切换
  dictionaryPage.value = page
}

function openCreateDictionaryGroupDialog() { // 打开新增父级字典弹窗
  editingDictionaryGroupCode.value = ''
  dictionaryGroupForm.value = {
    dictionaryCode: '',
    dictionaryName: '',
  }
  dictionaryGroupDialogVisible.value = true
}

function openEditDictionaryGroupDialog(group: DictionaryGroupResponse) { // 打开修改父级字典弹窗
  editingDictionaryGroupCode.value = group.dictionary_code
  dictionaryGroupForm.value = {
    dictionaryCode: group.dictionary_code,
    dictionaryName: group.dictionary_name,
  }
  dictionaryGroupDialogVisible.value = true
}

async function saveDictionaryGroup() { // 保存父级字典
  if (dictionaryGroupSaving.value) return
  const form = dictionaryGroupForm.value
  if (!form.dictionaryCode.trim() || !form.dictionaryName.trim()) {
    ElMessage.warning('请填写父级字典编码和名称')
    return
  }

  dictionaryGroupSaving.value = true
  try {
    if (editingDictionaryGroupCode.value) {
      await updateDictionaryGroup(editingDictionaryGroupCode.value, {
        dictionary_name: form.dictionaryName.trim(),
      })
      ElMessage.success('父级字典已修改')
    } else {
      await createDictionaryGroup({
        dictionary_code: form.dictionaryCode.trim(),
        dictionary_name: form.dictionaryName.trim(),
      })
      ElMessage.success('父级字典已新增')
    }
    dictionaryGroupDialogVisible.value = false
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '父级字典保存失败')
  } finally {
    dictionaryGroupSaving.value = false
  }
}

function dictionaryParentOptions() { // 当前父级字典下可选择的父节点
  return activeDictionaryGroup.value ? flattenDictionaryItems(activeDictionaryGroup.value.items) : []
}

function resetDictionaryForm(group?: DictionaryGroupResponse) { // 重置字典项表单
  dictionaryForm.value = {
    dictionaryCode: group?.dictionary_code || '',
    dictionaryName: group?.dictionary_name || '',
    itemCode: '',
    itemName: '',
    parentItemId: '',
    sortOrder: 0,
    enabled: true,
    description: '',
    metadataText: '{}',
  }
  editingDictionaryItemId.value = ''
}

function openCreateDictionaryItemDialog() { // 打开新增字典项弹窗
  resetDictionaryForm(activeDictionaryGroup.value || undefined)
  dictionaryItemDialogVisible.value = true
}

function openEditDictionaryItemDialog(item: DictionaryItemResponse) { // 打开修改字典项弹窗
  editingDictionaryItemId.value = item.dictionary_item_id
  dictionaryForm.value = {
    dictionaryCode: item.dictionary_code,
    dictionaryName: item.dictionary_name,
    itemCode: item.item_code,
    itemName: item.item_name,
    parentItemId: item.parent_item_id || '',
    sortOrder: item.sort_order,
    enabled: item.enabled,
    description: item.description || '',
    metadataText: JSON.stringify(item.metadata || {}, null, 2),
  }
  dictionaryItemDialogVisible.value = true
}

function parseDictionaryMetadata() { // 解析字典项扩展元数据
  const rawText = dictionaryForm.value.metadataText.trim()
  if (!rawText) return {}
  const parsed = JSON.parse(rawText)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('扩展元数据必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

async function saveDictionaryItem() { // 保存新增或修改后的字典项
  if (dictionaryItemSaving.value) return
  const form = dictionaryForm.value
  if (!form.dictionaryCode.trim() || !form.dictionaryName.trim() || !form.itemCode.trim() || !form.itemName.trim()) {
    ElMessage.warning('请填写字典编码、字典名称、项编码和项名称')
    return
  }

  dictionaryItemSaving.value = true
  try {
    const payload = {
      dictionary_code: form.dictionaryCode.trim(),
      dictionary_name: form.dictionaryName.trim(),
      item_code: form.itemCode.trim(),
      item_name: form.itemName.trim(),
      parent_item_id: form.parentItemId || null,
      sort_order: Number(form.sortOrder) || 0,
      enabled: form.enabled,
      description: form.description.trim() || null,
      metadata: parseDictionaryMetadata(),
    }
    if (editingDictionaryItemId.value) {
      await updateDictionaryItem(editingDictionaryItemId.value, payload)
      ElMessage.success('字典项已修改')
    } else {
      await createDictionaryItem(payload)
      ElMessage.success('字典项已新增')
    }
    dictionaryItemDialogVisible.value = false
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典项保存失败')
  } finally {
    dictionaryItemSaving.value = false
  }
}

async function toggleDictionaryItemEnabled(item: DictionaryItemResponse) { // 启用或禁用字典项
  const nextEnabled = !item.enabled
  activeDictionaryAction.value = dictionaryActionKey('enabled', item.dictionary_item_id)
  try {
    await setDictionaryItemEnabled(item.dictionary_item_id, nextEnabled)
    ElMessage.success(nextEnabled ? '字典项已启用' : '字典项已禁用')
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '启用状态更新失败')
  } finally {
    activeDictionaryAction.value = ''
  }
}

async function handleDeleteDictionaryItem(item: DictionaryItemResponse) { // 删除字典项
  const confirmed = await confirmDangerOnce(
    `确定删除字典项「${item.item_name}」吗？存在子级时需要先删除子级。`,
    '删除字典项',
    '删除',
  )
  if (!confirmed) return

  activeDictionaryAction.value = dictionaryActionKey('delete', item.dictionary_item_id)
  try {
    await deleteDictionaryItem(item.dictionary_item_id)
    ElMessage.success('字典项已删除')
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '字典项删除失败')
  } finally {
    activeDictionaryAction.value = ''
  }
}

async function handleDeleteDictionaryGroup(group: DictionaryGroupResponse) { // 删除父级字典及其全部子项
  const confirmed = await confirmDangerOnce(
    `确定删除父级字典「${group.dictionary_name}」吗？这会删除 ${dictionaryGroupItemCount(group)} 个字典项，无法撤销。`,
    '删除父级字典',
    '删除父级',
  )
  if (!confirmed) return

  activeDictionaryAction.value = `group:${group.dictionary_code}`
  try {
    await deleteDictionaryGroup(group.dictionary_code)
    ElMessage.success('父级字典已删除')
    if (activeDictionaryCode.value === group.dictionary_code) {
      activeDictionaryCode.value = ''
    }
    await refreshDictionaries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '父级字典删除失败')
  } finally {
    activeDictionaryAction.value = ''
  }
}

onMounted(() => {
  void refreshDashboard()
})
</script>

<template>
  <div class="dashboard-page">
    <input
      ref="knowledgeFileInput"
      class="hidden-file-input"
      type="file"
      accept=".txt,.pdf"
      @change="handleKnowledgeFileChange"
    >

    <header class="page-hero">
      <div>
        <span class="page-kicker"><Activity :size="14" /> 系统驾驶舱</span>
        <h2>知识服务总览</h2>
        <p>集中维护知识库、字典表、服务状态与接口配置，智能客服页面只负责问答。</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button class="tech-button primary" :icon="DatabaseZap" @click="openKnowledgeDialog">知识库管理</el-button>
        <el-button class="tech-button" :icon="FileText" @click="openDictionaryDialog">字典表管理</el-button>
        <el-button class="tech-button" :icon="Clock3" @click="openRecentConversationDialog">最近会话</el-button>
        <el-button class="tech-button" :icon="GraduationCap" @click="openExamRecordDialog">考试记录</el-button>
      </div>
    </header>

    <section class="sales-cockpit">
      <div class="sales-cockpit-main">
        <div class="sales-cockpit-heading">
          <span class="page-kicker"><BrainCircuit :size="14" /> AI销售训练驾驶舱</span>
          <h3>从训练资料到实战复盘的销售能力闭环</h3>
          <p>聚合训练资料、AI 客户方案、对话会话和评分状态，首页只展示运行态势，具体配置进入销售陪练模块处理。</p>
        </div>
        <div class="sales-cockpit-actions">
          <el-button class="tech-button primary" :icon="Sparkles" @click="openSalesTraining">进入销售陪练</el-button>
          <el-button class="tech-button" :icon="Upload" @click="openTrainingKnowledgeDialog">上传训练资料</el-button>
          <el-button class="tech-button" :icon="RefreshCw" :loading="loading" @click="refreshDashboard">刷新训练态势</el-button>
        </div>
      </div>

      <div class="sales-stat-grid">
        <article v-for="item in salesTrainingStats" :key="item.label" class="sales-stat-card" :class="`tone-${item.tone}`">
          <span><component :is="item.icon" :size="16" /></span>
          <div>
            <strong>{{ item.value }}</strong>
            <em>{{ item.label }}</em>
            <p>{{ item.detail }}</p>
          </div>
        </article>
      </div>

      <div class="sales-cockpit-lower">
        <div class="sales-flow-panel">
          <div class="panel-title panel-title-between">
            <span><Target :size="16" />训练链路</span>
            <em>{{ trainingFailedBatchCount }} 个异常批次</em>
          </div>
          <div class="sales-flow-steps">
            <article v-for="step in trainingTimeline" :key="step.title" :class="`status-${step.status}`">
              <span></span>
              <div>
                <strong>{{ step.title }}</strong>
                <p>{{ step.detail }}</p>
              </div>
            </article>
          </div>
        </div>

        <div class="sales-recent-panel">
          <div class="panel-title panel-title-between">
            <span><GraduationCap :size="16" />最近训练</span>
            <em>{{ trainingSessionTotal }} 条记录</em>
          </div>
          <div class="sales-recent-list">
            <button
              v-for="session in overviewPagedTrainingSessions"
              :key="session.session_id"
              type="button"
              @click="openSalesTraining"
            >
              <span>
                <strong>{{ trainingSessionLabel(session.status) }}</strong>
                <em>{{ session.answered_count }}/{{ session.round_limit }} 轮 · {{ session.response_mode === 'stream' ? '流式' : '一次性' }}</em>
              </span>
              <b v-if="session.total_score !== null && session.total_score !== undefined">{{ session.total_score }}</b>
              <ChevronRight v-else :size="17" />
            </button>
            <p v-if="trainingSessions.length === 0">暂无训练会话</p>
          </div>
          <el-pagination
            v-if="trainingSessions.length > overviewSalesCardPageSize"
            v-model:current-page="overviewTrainingSessionPage"
            class="sales-mini-pagination"
            small
            background
            layout="prev, pager, next"
            :page-size="overviewSalesCardPageSize"
            :total="trainingSessions.length"
          />
        </div>

        <div class="sales-recent-panel">
          <div class="panel-title panel-title-between">
            <span><DatabaseZap :size="16" />训练资料</span>
            <em>{{ trainingBatchTotal }} 个批次</em>
          </div>
          <div class="sales-batch-list">
            <button
              v-for="batch in overviewPagedTrainingBatches"
              :key="batch.batch_id"
              type="button"
              @click="openSalesTraining"
            >
              <span>
                <strong>{{ batch.source_file }}</strong>
                <em>v{{ batch.version_no }} · {{ trainingBatchLabel(batch.status) }} · {{ batch.chunk_count }} 切片</em>
              </span>
              <ChevronRight :size="17" />
            </button>
            <p v-if="trainingBatches.length === 0">暂无训练资料</p>
          </div>
          <el-pagination
            v-if="trainingBatches.length > overviewSalesCardPageSize"
            v-model:current-page="overviewTrainingBatchPage"
            class="sales-mini-pagination"
            small
            background
            layout="prev, pager, next"
            :page-size="overviewSalesCardPageSize"
            :total="trainingBatches.length"
          />
        </div>
      </div>
    </section>

    <el-dialog
      v-model="recentConversationDialogVisible"
      title="最近会话"
      width="760px"
      class="recent-conversation-dialog"
    >
      <article class="dashboard-panel conversation-dialog-panel">
        <div class="panel-title panel-title-between">
          <span><Clock3 :size="16" />最近会话</span>
          <em>{{ conversationTotal }} 条记录</em>
        </div>
        <div class="recent-conversation-strip" aria-label="最近会话概览">
          <span>最近</span>
          <em>{{ overviewConversationPageSize }} 条/页</em>
        </div>
        <div class="data-table-lite">
          <div
            v-for="conversation in overviewPagedConversations"
            :key="conversation.conversation_id"
            class="clickable-data-row"
            role="button"
            tabindex="0"
            @click="openConversationHistory(conversation)"
            @keydown.enter="openConversationHistory(conversation)"
          >
            <el-tooltip :content="conversationTooltipContent(conversation)" placement="top" popper-class="smart-tooltip" teleported>
              <span @mouseenter="loadConversationTooltip(conversation)">
                {{ conversationFallbackTitle(conversation) }}
              </span>
            </el-tooltip>
            <el-tooltip :content="formatDateTime(conversation.last_message_at || conversation.updated_at)" placement="top" popper-class="smart-tooltip" teleported>
              <em>{{ formatDateTime(conversation.last_message_at || conversation.updated_at) }}</em>
            </el-tooltip>
          </div>
          <p v-if="conversations.length === 0">暂无聊天记录</p>
        </div>
        <el-pagination
          v-if="conversations.length > 0"
          v-model:current-page="overviewConversationPage"
          class="dashboard-mini-pagination"
          small
          background
          layout="prev, pager, next"
          :page-size="overviewConversationPageSize"
          :total="conversations.length"
        />
      </article>

      <template #footer>
        <el-button :icon="RefreshCw" :loading="loading" @click="refreshDashboard">刷新会话</el-button>
        <el-button type="primary" @click="recentConversationDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="examRecordDialogVisible"
      title="考试记录"
      width="820px"
      class="recent-conversation-dialog exam-record-dialog"
    >
      <article class="dashboard-panel conversation-dialog-panel">
        <div class="panel-title panel-title-between">
          <span><GraduationCap :size="16" />考试记录</span>
          <em>{{ examSessionTotal }} 条记录</em>
        </div>
        <div class="recent-conversation-strip" aria-label="考试记录概览">
          <span>最近测评</span>
          <em>{{ overviewExamSessionPageSize }} 条/页</em>
        </div>
        <div class="data-table-lite exam-record-table">
          <article v-for="session in overviewPagedExamSessions" :key="session.session_id" class="exam-record-row">
            <button type="button" class="exam-record-main" @click="openExamDetail(session)">
              <span>
                <strong>{{ session.title }}</strong>
                <small>{{ examRecordSourceText(session) }}</small>
              </span>
              <em>{{ session.total_score.toFixed(1) }}/100 · {{ session.answered_count }}/{{ session.round_count }}</em>
            </button>
            <el-button
              circle
              plain
              type="danger"
              :icon="Trash2"
              :loading="examDeletingId === session.session_id"
              @click.stop="handleDeleteExamSession(session)"
            />
          </article>
          <p v-if="examSessions.length === 0">暂无考试记录</p>
        </div>
        <el-pagination
          v-if="examSessions.length > 0"
          v-model:current-page="overviewExamSessionPage"
          class="dashboard-mini-pagination"
          small
          background
          layout="prev, pager, next"
          :page-size="overviewExamSessionPageSize"
          :total="examSessions.length"
        />
      </article>

      <template #footer>
        <el-button :icon="RefreshCw" :loading="loading" @click="refreshDashboard">刷新记录</el-button>
        <el-button type="primary" @click="examRecordDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="examDetailVisible"
      title="考试详情"
      width="860px"
      class="knowledge-preview-dialog exam-detail-dialog"
    >
      <div v-loading="examDetailLoading" class="exam-detail-body">
        <template v-if="selectedExamDetail">
          <section class="exam-detail-summary">
            <strong>{{ selectedExamDetail.session.title }}</strong>
            <span>{{ selectedExamDetail.session.total_score.toFixed(1) }}/100 分</span>
            <em>{{ examRecordSourceText(selectedExamDetail.session) }}</em>
          </section>
          <article v-for="record in selectedExamDetail.questions" :key="record.question.exam_question_id" class="exam-detail-question">
            <div>
              <strong>第 {{ record.question.round_no }} 轮 · {{ record.question.question_type }}</strong>
              <em>{{ examRecordSourceText(selectedExamDetail.session) }}</em>
            </div>
            <p>{{ record.question.prompt }}</p>
            <div v-if="record.question.options.length" class="exam-option-preview">
              <span v-for="option in record.question.options" :key="option">{{ option }}</span>
            </div>
            <p class="detail-user-answer">用户回答：{{ record.user_answer || '未作答' }}</p>
            <div v-if="record.analysis" class="exam-analysis-card">
              <strong>{{ record.analysis.score.toFixed(1) }}/{{ record.analysis.max_score.toFixed(1) }} 分</strong>
              <p>正确答案：{{ Array.isArray(record.analysis.correct_answer) ? record.analysis.correct_answer.join('、') : record.analysis.correct_answer }}</p>
              <p>遗漏点：{{ safeList(record.analysis.missing_points).join('、') }}</p>
              <p>点评：{{ record.analysis.comment || '暂无点评' }}</p>
            </div>
          </article>
        </template>
      </div>
    </el-dialog>

    <el-dialog
      v-model="knowledgeDialogVisible"
      title="知识库管理"
      width="1180px"
      class="knowledge-dialog"
    >
      <div class="knowledge-mode-tabs" role="group" aria-label="知识库管理类型">
        <button
          type="button"
          class="knowledge-mode-tab"
          :class="{ active: knowledgeDialogTab === 'general' }"
          @click="knowledgeDialogTab = 'general'"
        >
          <DatabaseZap :size="17" />
          <span>通用知识库</span>
          <em>{{ knowledgeFiles.length }} 个文件</em>
        </button>
        <button
          type="button"
          class="knowledge-mode-tab"
          :class="{ active: knowledgeDialogTab === 'salesTraining' }"
          @click="knowledgeDialogTab = 'salesTraining'"
        >
          <BrainCircuit :size="17" />
          <span>销售训练资料</span>
          <em>{{ trainingKnowledgeBatchTotal }} 批资料</em>
        </button>
      </div>

      <section v-if="knowledgeDialogTab === 'general'" class="knowledge-mode-panel">
        <div class="dialog-toolbar">
          <div class="dialog-toolbar-main">
            <div>
              <strong>{{ filteredKnowledgeFiles.length }}</strong>
              <span>个文件</span>
              <em>{{ activeIndexedKnowledgeCount }} 个已索引</em>
            </div>
            <el-input
              v-model="knowledgeKeyword"
              class="dialog-search-input"
              clearable
              :prefix-icon="Search"
              placeholder="按文件名模糊查询"
            />
          </div>
          <div class="dialog-actions">
            <el-button :icon="Upload" :loading="uploadingKnowledge" type="primary" @click="openKnowledgeFilePicker">
              上传文件
            </el-button>
            <el-button :icon="RefreshCw" :loading="knowledgeLoading" @click="refreshKnowledgeFiles">
              刷新
            </el-button>
            <el-button :icon="RefreshCw" :loading="reindexingAll" type="warning" plain @click="handleReindexAllKnowledgeFiles">
              清空并重建
            </el-button>
          </div>
        </div>

        <div class="knowledge-collection-tabs" role="tablist" aria-label="知识库列表">
          <button
            v-for="tab in knowledgeCollectionTabs"
            :key="tab.collectionName"
            type="button"
            class="knowledge-collection-tab"
            :class="{ active: activeKnowledgeCollection === tab.collectionName }"
            role="tab"
            :aria-selected="activeKnowledgeCollection === tab.collectionName"
            @click="activeKnowledgeCollection = tab.collectionName"
          >
            <span>{{ tab.collectionName }}</span>
            <em>{{ tab.indexed }}/{{ tab.total }} 已索引</em>
          </button>
        </div>

        <div v-loading="knowledgeLoading" class="knowledge-dialog-body">
          <div v-if="knowledgeFiles.length === 0" class="empty-knowledge">暂无知识库文件</div>
          <div v-else-if="filteredKnowledgeFiles.length === 0" class="empty-knowledge">没有匹配的知识库文件</div>
          <div v-else class="knowledge-grid">
            <article v-for="file in pagedKnowledgeFiles" :key="file.document_id" class="knowledge-file">
              <div class="knowledge-file-main">
                <FileText :size="18" />
                <div class="knowledge-file-info">
                  <strong>{{ file.filename }}</strong>
                  <span>{{ file.file_type.toUpperCase() }} · {{ formatFileSize(file.file_size) }} · {{ file.chunk_count }} chunks</span>
                </div>
                <el-tag :type="knowledgeStatusType(file.status)" effect="plain" size="small">
                  {{ file.status }}
                </el-tag>
              </div>
              <div class="knowledge-file-meta">
                <span>版本 v{{ file.version }}</span>
                <span>{{ formatDateTime(file.updated_at) }}</span>
              </div>
              <div v-if="file.error_message" class="knowledge-error">{{ file.error_message }}</div>
              <div class="knowledge-file-actions">
                <el-button
                  :icon="Eye"
                  size="small"
                  :loading="activeKnowledgeAction === knowledgeActionKey('preview', file.document_id)"
                  :disabled="Boolean(activeKnowledgeAction)"
                  @click="handlePreviewKnowledgeFile(file)"
                >
                  预览
                </el-button>
                <el-button
                  :icon="RefreshCw"
                  size="small"
                  :loading="activeKnowledgeAction === knowledgeActionKey('reindex', file.document_id)"
                  :disabled="Boolean(activeKnowledgeAction)"
                  @click="handleReindexKnowledgeFile(file)"
                >
                  重建
                </el-button>
                <el-button
                  :icon="Trash2"
                  plain
                  size="small"
                  type="danger"
                  :loading="activeKnowledgeAction === knowledgeActionKey('delete', file.document_id)"
                  :disabled="Boolean(activeKnowledgeAction)"
                  @click="handleDeleteKnowledgeFile(file)"
                >
                  删除
                </el-button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section v-else class="knowledge-mode-panel training-knowledge-dialog-body">
        <TrainingKnowledgeUploadPanel
          :selected-file="trainingKnowledgeSelectedFile"
          :upload-result="trainingKnowledgeUploadResult"
          :uploading="trainingKnowledgeUploading"
          :upload-help-description="trainingKnowledgeUploadHelpDescription"
          :current-upload-chunk-count="trainingKnowledgeCurrentUploadChunkCount"
          :current-upload-point-count="trainingKnowledgeCurrentUploadPointCount"
          :current-upload-status="trainingKnowledgeCurrentUploadStatus"
          :current-upload-duplicate-text="trainingKnowledgeCurrentUploadDuplicateText"
          :can-clear-upload-area="trainingKnowledgeCanClearUploadArea"
          :upload-quality-report="trainingKnowledgeUploadQualityReport"
          :upload-quality-warnings="trainingKnowledgeUploadQualityWarnings"
          :upload-quality-metrics="trainingKnowledgeUploadQualityMetrics"
          :upload-quality-split-text="trainingKnowledgeUploadQualitySplitText"
          :upload-publish-validation="trainingKnowledgeUploadPublishValidation"
          :publishing-batch-id="trainingKnowledgePublishingBatchId"
          :reparsing-batch-id="trainingKnowledgeReparsingBatchId"
          :quality-level-label="trainingKnowledgeQualityLevelLabel"
          :quality-level-class="trainingKnowledgeQualityLevelClass"
          @file-change="onTrainingKnowledgeFileChange"
          @clear-upload="clearTrainingKnowledgeUploadArea"
          @upload="uploadTrainingKnowledgeFile"
          @publish-batch="publishTrainingKnowledgeFileBatch"
          @reparse-batch="reparseTrainingKnowledgeFileBatch"
        />
        <TrainingKnowledgeWorkspace
          v-model:batch-page="trainingKnowledgeBatchPage"
          v-model:chunk-structure-visible="trainingKnowledgeChunkStructureVisible"
          v-model:chunk-detail-visible="trainingKnowledgeChunkDetailVisible"
          v-model:version-dialog-visible="trainingKnowledgeVersionDialogVisible"
          :training-batches="trainingBatches"
          :batch-total="trainingKnowledgeBatchTotal"
          :active-batch-id="trainingKnowledgeActiveBatchId"
          :chunk-type-summaries="trainingKnowledgeChunkTypeSummaries"
          :active-chunk-type-chunks="trainingKnowledgeActiveChunkTypeChunks"
          :active-chunk-summary="trainingKnowledgeActiveChunkSummary"
          :batch-versions="trainingKnowledgeBatchVersions"
          :active-version-group-id="trainingKnowledgeActiveVersionGroupId"
          :loading-batches="trainingKnowledgeLoadingBatches"
          :loading-chunks="trainingKnowledgeLoadingChunks"
          :publishing-batch-id="trainingKnowledgePublishingBatchId"
          :rolling-back-batch-id="trainingKnowledgeRollingBackBatchId"
          :reparsing-batch-id="trainingKnowledgeReparsingBatchId"
          :previewing-batch-id="trainingKnowledgePreviewingBatchId"
          :deleting-batch-id="trainingKnowledgeDeletingBatchId"
          :version-loading="trainingKnowledgeVersionLoading"
          :format-time="formatDateTime"
          :batch-status-label="trainingKnowledgeBatchStatusLabel"
          :chunk-summary-title="trainingKnowledgeChunkSummaryTitle"
          :chunk-usage-label="trainingKnowledgeChunkUsageLabel"
          :case-part-label="trainingKnowledgeCasePartLabel"
          :chunk-detail-meta="trainingKnowledgeChunkDetailMeta"
          @refresh-batches="refreshTrainingKnowledgeBatches"
          @publish-batch="publishTrainingKnowledgeFileBatch"
          @reparse-batch="reparseTrainingKnowledgeFileBatch"
          @rollback-batch="rollbackTrainingKnowledgeFileBatch"
          @open-batch-versions="openTrainingKnowledgeBatchVersions"
          @open-training-batch="openTrainingKnowledgeBatch"
          @preview-batch="previewTrainingKnowledgeFileBatch"
          @delete-batch="deleteTrainingKnowledgeFileBatch"
          @open-chunk-summary="openTrainingKnowledgeChunkSummary"
          @close-chunk-structure="closeTrainingKnowledgeChunkStructure"
        />
      </section>

      <template #footer>
        <el-pagination
          v-if="knowledgeDialogTab === 'general'"
          v-model:current-page="knowledgePage"
          background
          layout="prev, pager, next"
          :page-size="knowledgePageSize"
          :total="filteredKnowledgeFiles.length"
        />
        <el-button v-else :icon="Sparkles" type="primary" @click="openSalesTraining">进入完整销售陪练</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryDialogVisible"
      title="字典表"
      width="1080px"
      class="dictionary-dialog"
    >
      <div class="dialog-toolbar">
        <div class="dialog-toolbar-main">
          <div>
            <strong>{{ activeDictionaryGroup ? activeDictionaryGroup.dictionary_name : dictionaries.length }}</strong>
            <span>{{ activeDictionaryGroup ? activeDictionaryGroup.dictionary_code : '组字典' }}</span>
            <em>{{ activeDictionaryGroup ? `${dictionaryGroupItemCount(activeDictionaryGroup)} 个字典项` : '点击父级字典进入子集' }}</em>
          </div>
        </div>
        <div class="dialog-actions">
          <el-button v-if="activeDictionaryGroup" :icon="ArrowLeft" @click="backToDictionaryGroups">返回父级</el-button>
          <el-button v-if="!activeDictionaryGroup" type="primary" @click="openCreateDictionaryGroupDialog">新增父级</el-button>
          <el-button v-if="activeDictionaryGroup" type="primary" @click="openCreateDictionaryItemDialog">新增字典项</el-button>
          <el-button
            v-if="activeDictionaryGroup"
            :icon="Trash2"
            plain
            type="danger"
            :loading="activeDictionaryAction === `group:${activeDictionaryGroup.dictionary_code}`"
            @click="handleDeleteDictionaryGroup(activeDictionaryGroup)"
          >
            删除父级
          </el-button>
          <el-button :icon="RefreshCw" :loading="dictionaryLoading" @click="refreshDictionaries">刷新</el-button>
        </div>
      </div>

      <div v-loading="dictionaryLoading" class="dictionary-dialog-body">
        <div v-if="dictionaries.length === 0" class="empty-knowledge">暂无字典项</div>
        <template v-else-if="!activeDictionaryGroup">
          <div class="dictionary-parent-grid">
            <button
              v-for="group in pagedDictionaryGroups"
              :key="group.dictionary_code"
              type="button"
              class="dictionary-parent-card"
              @click="openDictionaryGroup(group)"
            >
              <span class="dictionary-parent-icon"><DatabaseZap :size="18" /></span>
              <span class="dictionary-parent-content">
                <strong>{{ group.dictionary_name }}</strong>
                <code>{{ group.dictionary_code }}</code>
                <em>{{ dictionaryGroupItemCount(group) }} 个字典项</em>
              </span>
              <span class="dictionary-parent-actions">
                <el-button :icon="Pencil" circle size="small" @click.stop="openEditDictionaryGroupDialog(group)" />
                <ChevronRight :size="18" />
              </span>
            </button>
          </div>
        </template>
        <section v-else class="dictionary-group">
          <div class="dictionary-group-title">
            <strong>{{ activeDictionaryGroup.dictionary_name }}</strong>
            <code>{{ activeDictionaryGroup.dictionary_code }}</code>
          </div>
          <el-table
            :data="activeDictionaryGroup.items"
            row-key="dictionary_item_id"
            default-expand-all
            :tree-props="{ children: 'children' }"
            size="small"
          >
            <el-table-column prop="item_name" label="名称" min-width="160" />
            <el-table-column prop="item_code" label="编码" min-width="180" />
            <el-table-column prop="item_level" label="层级" width="80" />
            <el-table-column prop="sort_order" label="排序" width="80" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain" size="small">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="260" />
            <el-table-column label="操作" width="230" fixed="right">
              <template #default="{ row }">
                <div class="dictionary-row-actions">
                  <el-button size="small" @click="openEditDictionaryItemDialog(row)">修改</el-button>
                  <el-button
                    size="small"
                    :loading="activeDictionaryAction === dictionaryActionKey('enabled', row.dictionary_item_id)"
                    @click="toggleDictionaryItemEnabled(row)"
                  >
                    {{ row.enabled ? '禁用' : '启用' }}
                  </el-button>
                  <el-button
                    plain
                    size="small"
                    type="danger"
                    :loading="activeDictionaryAction === dictionaryActionKey('delete', row.dictionary_item_id)"
                    @click="handleDeleteDictionaryItem(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>

      <template #footer>
        <el-pagination
          v-if="!activeDictionaryGroup"
          v-model:current-page="dictionaryPage"
          background
          layout="prev, pager, next"
          :page-size="dictionaryPageSize"
          :total="dictionaries.length"
          @current-change="handleDictionaryPageChange"
        />
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryGroupDialogVisible"
      :title="editingDictionaryGroupCode ? '修改父级字典' : '新增父级字典'"
      width="560px"
      class="dictionary-dialog"
    >
      <el-form class="dictionary-form" label-position="top">
        <el-form-item label="父级字典编码">
          <el-input v-model="dictionaryGroupForm.dictionaryCode" :disabled="Boolean(editingDictionaryGroupCode)" placeholder="例如：model_mode" />
        </el-form-item>
        <el-form-item label="父级字典名称">
          <el-input v-model="dictionaryGroupForm.dictionaryName" placeholder="例如：回答模型档位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryGroupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictionaryGroupSaving" @click="saveDictionaryGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryItemDialogVisible"
      :title="editingDictionaryItemId ? '修改字典项' : '新增字典项'"
      width="720px"
      class="dictionary-dialog"
    >
      <el-form class="dictionary-form" label-position="top">
        <div class="dictionary-form-grid">
          <el-form-item label="字典编码">
            <el-input v-model="dictionaryForm.dictionaryCode" :disabled="Boolean(editingDictionaryItemId)" />
          </el-form-item>
          <el-form-item label="字典名称">
            <el-input v-model="dictionaryForm.dictionaryName" />
          </el-form-item>
          <el-form-item label="项编码">
            <el-input v-model="dictionaryForm.itemCode" />
          </el-form-item>
          <el-form-item label="项名称">
            <el-input v-model="dictionaryForm.itemName" />
          </el-form-item>
          <el-form-item label="父级字典项">
            <el-select v-model="dictionaryForm.parentItemId" clearable filterable placeholder="不选择则为一级项">
              <el-option label="无父级" value="" />
              <el-option
                v-for="item in dictionaryParentOptions()"
                :key="item.dictionary_item_id"
                :disabled="item.dictionary_item_id === editingDictionaryItemId"
                :label="`${item.item_name}（${item.item_code}）`"
                :value="item.dictionary_item_id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="dictionaryForm.sortOrder" :min="0" :step="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="dictionaryForm.enabled" active-text="启用" inactive-text="禁用" inline-prompt />
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="dictionaryForm.description" />
          </el-form-item>
        </div>
        <el-form-item label="扩展元数据 JSON">
          <el-input v-model="dictionaryForm.metadataText" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" placeholder='例如：{"default": true}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryItemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dictionaryItemSaving" @click="saveDictionaryItem">保存</el-button>
      </template>
    </el-dialog>

    <FilePreviewDialog
      v-model="knowledgePreviewVisible"
      :loading="knowledgePreviewLoading"
      theme-mode="dark"
      title="文件预览"
      :preview="knowledgePreview
        ? {
          file: {
            filename: knowledgePreview.document.filename,
            file_type: knowledgePreview.document.file_type,
            file_size: knowledgePreview.document.file_size,
          },
          preview_type: knowledgePreview.preview_type,
          content: knowledgePreview.content,
          truncated: knowledgePreview.truncated,
          file_url: knowledgePreview.file_url,
          charset: knowledgePreview.charset,
        }
        : null"
    />

    <FilePreviewDialog
      v-model="trainingKnowledgePreviewVisible"
      :loading="trainingKnowledgePreviewLoading"
      theme-mode="dark"
      title="训练资料预览"
      :preview="trainingKnowledgePreview
        ? {
          file: {
            filename: trainingKnowledgePreview.batch.source_file,
            file_type: trainingKnowledgePreview.batch.source_file?.split('.').pop() || '未知类型',
            file_size: null,
          },
          preview_type: trainingKnowledgePreview.preview_type,
          content: trainingKnowledgePreview.content,
          truncated: trainingKnowledgePreview.truncated,
          file_url: trainingKnowledgePreview.file_url,
          charset: trainingKnowledgePreview.charset,
        }
        : null"
    />

    <el-dialog
      v-model="uploadPreviewVisible"
      title="确认入库配置"
      width="640px"
      class="upload-preview-dialog"
    >
      <div v-if="uploadPreview" class="upload-preview">
        <div class="preview-summary">
          <div>
            <span>文件</span>
            <strong>{{ uploadPreview.filename }}</strong>
          </div>
          <div>
            <span>大小</span>
            <strong>{{ formatFileSize(uploadPreview.file_size) }}</strong>
          </div>
          <div>
            <span>推荐来源</span>
            <strong>{{ uploadRecommendation ? '模型' : '默认' }}</strong>
          </div>
        </div>

        <div class="recommend-toolbar">
          <div>
            <strong>{{ uploadRecommendation ? `模型置信度 ${Math.round(uploadRecommendation.confidence * 100)}%` : '默认使用通用递归切分' }}</strong>
            <span v-if="uploadRecommendation">{{ uploadRecommendation.model_name }} · {{ uploadRecommendation.sample_chars }} 字符样本</span>
            <span v-else>需要更精细切分时，可以让模型读取结构样本后推荐。</span>
          </div>
          <el-button :icon="Bot" :loading="recommendingKnowledge" :disabled="confirmingKnowledge" type="primary" plain @click="handleRecommendKnowledgeUpload">
            模型推荐
          </el-button>
        </div>

        <div class="preview-form">
          <label>
            <span>Collection</span>
            <el-select v-model="selectedUploadCollection" filterable allow-create default-first-option placeholder="选择或输入 Collection">
              <el-option v-for="collectionName in collectionOptions" :key="collectionName" :label="collectionName" :value="collectionName" />
            </el-select>
          </label>
          <label>
            <span>文档结构</span>
            <el-select v-model="selectedDocumentType" placeholder="选择文档结构">
              <el-option v-for="item in dictionaryItems('document_structure')" :key="item.item_code" :label="item.item_name" :value="item.item_code" />
            </el-select>
          </label>
          <label>
            <span>切分策略</span>
            <el-select v-model="selectedSplitStrategy" placeholder="选择切分策略">
              <el-option v-for="item in dictionaryItems('split_strategy')" :key="item.item_code" :label="item.item_name" :value="item.item_code" />
            </el-select>
          </label>
        </div>

        <div class="preview-reasons">
          <span>{{ uploadRecommendation ? '模型推荐原因' : '默认原因' }}</span>
          <p v-for="reason in (uploadRecommendation?.reasons || uploadPreview.reasons)" :key="reason">{{ reason }}</p>
        </div>

        <div class="preview-sample">
          <span>文本预览</span>
          <pre>{{ uploadPreview.sample_text }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button :disabled="confirmingKnowledge" @click="uploadPreviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="confirmingKnowledge" @click="handleConfirmKnowledgeUpload">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.knowledge-mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--border-color, rgba(148, 163, 184, 0.24)) 76%, #22d3ee 24%);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--card-bg, rgba(15, 23, 42, 0.72)) 92%, #38bdf8 8%), transparent),
    color-mix(in srgb, var(--panel-bg, rgba(15, 23, 42, 0.72)) 88%, transparent);
}

.knowledge-mode-tab {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 11px 13px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary, rgba(226, 232, 240, 0.72));
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.knowledge-mode-tab::after {
  position: absolute;
  right: 16px;
  bottom: 0;
  left: 16px;
  height: 2px;
  content: "";
  background: linear-gradient(90deg, transparent, #22d3ee, #8b5cf6, transparent);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.knowledge-mode-tab:hover,
.knowledge-mode-tab.active {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #22d3ee 52%, var(--border-color, rgba(148, 163, 184, 0.24)));
  color: var(--text-primary, #f8fafc);
  background:
    linear-gradient(135deg, color-mix(in srgb, #22d3ee 14%, transparent), color-mix(in srgb, #8b5cf6 10%, transparent)),
    color-mix(in srgb, var(--card-bg, rgba(15, 23, 42, 0.72)) 92%, transparent);
}

.knowledge-mode-tab.active::after {
  opacity: 1;
}

.knowledge-mode-tab svg {
  color: #22d3ee;
}

.knowledge-mode-tab span {
  overflow: hidden;
  color: inherit;
  font-size: 14px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-mode-tab em {
  color: var(--text-secondary, rgba(226, 232, 240, 0.66));
  font-size: 12px;
  font-style: normal;
  white-space: nowrap;
}

.knowledge-mode-panel {
  min-width: 0;
  min-height: 0;
}

.training-knowledge-dialog-body {
  display: grid;
  grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  max-height: min(72vh, 760px);
  overflow: auto;
  padding-right: 2px;
}

.exam-record-table {
  gap: 9px;
}

.exam-record-table > .exam-record-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.exam-record-row::before {
  background: linear-gradient(180deg, #38bdf8, #22c55e);
}

.exam-record-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.exam-record-main > span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.exam-record-main strong {
  overflow: hidden;
  color: var(--text-primary, #e5eefb);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exam-record-main small {
  overflow: hidden;
  color: var(--text-secondary, rgba(226, 232, 240, 0.64));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exam-detail-dialog :deep(.el-dialog__body) {
  max-height: min(72vh, 760px);
  overflow: auto;
}

.sales-cockpit {
  position: relative;
  display: grid;
  grid-template-rows: auto auto auto;
  align-content: start;
  gap: 12px;
  min-height: 0;
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--border-color, rgba(148, 163, 184, 0.24)) 70%, #2dd4bf 30%);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--panel-bg, rgba(15, 23, 42, 0.8)) 88%, #22d3ee 12%), transparent),
    var(--panel-bg, rgba(15, 23, 42, 0.72));
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.14);
  overflow: hidden;
}

.sales-cockpit::before {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.12), transparent),
    repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.08) 0 1px, transparent 1px 84px);
  opacity: 0.55;
}

.sales-cockpit-main,
.sales-stat-grid,
.sales-cockpit-lower {
  position: relative;
  z-index: 1;
}

.sales-cockpit-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sales-cockpit-heading {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.sales-cockpit-heading h3 {
  margin: 0;
  color: var(--text-primary, #e5eefb);
  font-size: 18px;
  font-weight: 750;
}

.sales-cockpit-heading p {
  max-width: 760px;
  margin: 0;
  color: var(--text-secondary, rgba(226, 232, 240, 0.72));
  font-size: 12px;
  line-height: 1.55;
}

.sales-cockpit-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.sales-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.sales-stat-card,
.sales-flow-panel,
.sales-recent-panel {
  border: 1px solid color-mix(in srgb, var(--border-color, rgba(148, 163, 184, 0.22)) 80%, #38bdf8 20%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card-bg, rgba(15, 23, 42, 0.66)) 88%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.sales-stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
}

.sales-stat-card > span {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  color: #e0f2fe;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.78), rgba(45, 212, 191, 0.42));
}

.sales-stat-card strong {
  display: block;
  color: var(--text-primary, #f8fafc);
  font-size: 20px;
  line-height: 1;
}

.sales-stat-card em,
.sales-stat-card p {
  display: block;
  margin: 0;
  font-style: normal;
}

.sales-stat-card em {
  margin-top: 3px;
  color: var(--text-primary, #e2e8f0);
  font-size: 12px;
  font-weight: 700;
}

.sales-stat-card p {
  margin-top: 2px;
  color: var(--text-secondary, rgba(226, 232, 240, 0.68));
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sales-stat-card.tone-violet > span {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.78), rgba(34, 211, 238, 0.36));
}

.sales-stat-card.tone-amber > span {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.78), rgba(20, 184, 166, 0.34));
}

.sales-stat-card.tone-blue > span {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.78), rgba(6, 182, 212, 0.42));
}

.sales-cockpit-lower {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: 10px;
  align-items: start;
  min-height: 0;
  overflow: hidden;
}

.sales-flow-panel,
.sales-recent-panel {
  display: grid;
  grid-template-rows: auto auto auto;
  align-content: start;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}

.sales-flow-steps {
  display: grid;
  gap: 8px;
  align-content: start;
  margin-top: 10px;
  overflow: auto;
}

.sales-flow-steps article {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.sales-flow-steps article > span {
  width: 10px;
  height: 10px;
  margin-top: 4px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.65);
  box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.1);
}

.sales-flow-steps article.status-ready > span {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12), 0 0 18px rgba(34, 197, 94, 0.34);
}

.sales-flow-steps article.status-active > span {
  background: #38bdf8;
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.12), 0 0 18px rgba(56, 189, 248, 0.38);
}

.sales-flow-steps strong,
.sales-recent-list strong,
.sales-batch-list strong {
  color: var(--text-primary, #e5eefb);
  font-size: 13px;
}

.sales-flow-steps p,
.sales-recent-list em,
.sales-batch-list em,
.sales-recent-list p,
.sales-batch-list p {
  margin: 3px 0 0;
  color: var(--text-secondary, rgba(226, 232, 240, 0.66));
  font-size: 12px;
  font-style: normal;
  line-height: 1.5;
}

.sales-recent-list,
.sales-batch-list {
  display: grid;
  align-content: start;
  gap: 6px;
  margin-top: 10px;
  min-height: 0;
  overflow: auto;
}

.sales-recent-list button,
.sales-batch-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 7px 9px;
  border: 1px solid color-mix(in srgb, var(--border-color, rgba(148, 163, 184, 0.18)) 75%, #22d3ee 25%);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 255, 255, 0.035);
  cursor: pointer;
  text-align: left;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.sales-recent-list button:hover,
.sales-batch-list button:hover {
  transform: translateY(-1px);
  border-color: rgba(34, 211, 238, 0.55);
  background: rgba(34, 211, 238, 0.08);
}

.sales-recent-list button > span,
.sales-batch-list button > span {
  min-width: 0;
}

.sales-recent-list strong,
.sales-batch-list strong {
  display: block;
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sales-recent-list b {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  color: #ecfeff;
  background: linear-gradient(135deg, #0891b2, #7c3aed);
  font-size: 13px;
}

.sales-mini-pagination {
  justify-content: flex-end;
  min-height: 24px;
  margin-top: 8px;
}

.sales-mini-pagination :deep(.el-pager li),
.sales-mini-pagination :deep(.btn-prev),
.sales-mini-pagination :deep(.btn-next) {
  background: rgba(255, 255, 255, 0.045);
  color: var(--text-secondary, rgba(226, 232, 240, 0.72));
}

.sales-mini-pagination :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #0891b2, #7c3aed);
  color: #fff;
}

@media (max-width: 1120px) {
  .sales-stat-grid,
  .sales-cockpit-lower {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sales-flow-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .knowledge-mode-tabs {
    grid-template-columns: 1fr;
  }

  .training-knowledge-dialog-body {
    grid-template-columns: 1fr;
  }

  .sales-cockpit-main,
  .sales-cockpit-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .sales-stat-grid,
  .sales-cockpit-lower {
    grid-template-columns: 1fr;
  }
}
</style>
