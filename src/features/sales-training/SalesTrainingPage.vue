<script setup lang="ts">
// 销售陪练一期页面：
// 1. 上传 LMS 案例并写入 sales_training_cases 向量库；
// 2. 根据学员画像、客户画像和场景生成 AI 客户；
// 3. 生成开放式目标和 LLM 动态轮数；
// 4. 支持一次性/流式文字训练，结束后生成评分报告。
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  ChevronUp,
  FileText,
  Gauge,
  LoaderCircle,
  MessageSquareText,
  Network,
  Play,
  Radar,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  UploadCloud,
  UserRoundCheck,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createTrainingPlan,
  deleteTrainingKnowledgeBatch,
  deleteTrainingPlan,
  generateTrainingFinalScore,
  generateTrainingGoalSetting,
  generateTrainingRole,
  generateTrainingSupplementQuestions,
  getTrainingPlanDetail,
  getTrainingSessionDetail,
  listTrainingKnowledgeBatchVersions,
  listTrainingKnowledgeBatches,
  listTrainingKnowledgeChunks,
  listTrainingPlans,
  listTrainingProfileDictionaries,
  listTrainingSessions,
  polishTrainingScenario,
  previewTrainingKnowledgeBatch,
  publishTrainingKnowledgeBatch,
  reparseTrainingKnowledgeBatch,
  rollbackTrainingKnowledgeBatch,
  startTrainingSession,
  submitTrainingTurn,
  submitTrainingTurnStream,
  uploadTrainingKnowledge,
  updateTrainingPlan,
  type DictionaryGroupResponse,
  type DictionaryItemResponse,
  type TrainingGoalSettingResponse,
  type TrainingKnowledgeBatchResponse,
  type TrainingKnowledgeChunkResponse,
  type TrainingKnowledgePreviewResponse,
  type TrainingKnowledgeUploadResponse,
  type TrainingPlanDetailResponse,
  type TrainingPlanSummaryResponse,
  type TrainingPlanUpdatePayload,
  type TrainingResponseMode,
  type TrainingRoleGenerateResponse,
  type TrainingScoreResponse,
  type TrainingSessionDetailResponse,
  type TrainingSessionSummaryResponse,
  type TrainingSessionResponse,
  type TrainingSupplementQuestion,
  type TrainingSupplementQuestionOption,
  type TrainingTraineeProfilePayload,
  type TrainingTurnResponse,
} from '../../shared/api'
import {
  asArray,
  compactText,
  displayOptionLabel,
  displayValue,
  hasDisplayValue,
  objectEntries,
  safeList,
  uniqueList,
  valueList,
} from '../../utils/trainingDisplay'
import TrainingKnowledgeWorkspace from '../../components/sales-training/TrainingKnowledgeWorkspace.vue'
import TrainingReviewWorkspace from '../../components/sales-training/TrainingReviewWorkspace.vue'

defineProps<{ themeMode: 'dark' | 'light' }>()

type TrainingWorkspaceTab = 'knowledge' | 'setup' | 'chat' | 'review'
type SetupFlowTab = 'plan' | 'role' | 'stage' | 'score'
type TrainingMessageRole = 'customer' | 'trainee' | 'system'

interface TrainingNextAction {
  title: string
  detail: string
  actionText: string
  tab: TrainingWorkspaceTab
  setupTab?: SetupFlowTab
}

interface TrainingMessage {
  id: string
  role: TrainingMessageRole
  content: string
  meta?: string
  streaming?: boolean
  analysis?: Record<string, unknown>
}

interface ProfileField {
  label: string
  value: unknown
}

interface ProfileFieldConfig {
  label: string
  keys: string[]
}

interface CustomerProfileField {
  itemCode: string
  label: string
  description: string
  fieldKey: string
  inputType: string
  defaultValue: string
  options: DictionaryOption[]
}

interface DictionaryOption {
  label: string
  value: string
}

interface CustomerProfileFieldGroup {
  title: string
  fields: CustomerProfileField[]
}

interface ChunkTypeSummary {
  casePart: string
  label: string
  count: number
  usageLabels: string[]
  sampleText: string
}

type ProfileFieldValue = string | string[]

const CUSTOMER_PROFILE_DICTIONARY_CODES = ['wzf_customer_manager', 'wm_ai_service', 'overseas_bd']
const DEFAULT_CUSTOMER_PROFILE_TYPE = 'overseas_bd'
const FALLBACK_SOURCE_TYPE_OPTIONS: DictionaryOption[] = [
  {
    label: 'LMS 销售训练案例',
    value: 'lms_case',
  },
]
const OVERSEAS_BD_PRODUCT_FOCUS_FIELDS = new Set([
  'overseas_bd_product_core_focus',
  'overseas_bd_product_secondary_focus',
])
const OVERSEAS_BD_SERVICE_FOCUS_FIELDS = new Set([
  'overseas_bd_service_core_focus',
  'overseas_bd_service_secondary_focus',
])
const CUSTOMER_PROFILE_SUMMARIES: Record<string, string> = {
  wzf_customer_manager: '陌拜、需求挖掘、套餐推荐、成单推进',
  wm_ai_service: '线上跟进、产品介绍、报价处理、售后处理、样品扩展',
  overseas_bd: '渠道开发、代理沟通、服务合作、样品推进',
}

interface TraineeProfileDraft {
  traineeId: string
  traineeName: string
  positionRole: string
  experienceLevel: string
  taskGoal: string
  weaknessTags: string[]
  studentPortraitOther: string
}

interface PlanEditDraft {
  planName: string
  traineeId: string
  traineeName: string
  positionRole: string
  experienceLevel: string
  taskGoal: string
  weaknessTags: string[]
  studentPortraitOther: string
  profileType: string
  customerProfileValues: Record<string, ProfileFieldValue>
  scenarioDescription: string
  extraDetails: string
  modelMode: string
  roleConfirmCardJson: string
  visibleProfileJson: string
  hiddenProfileJson: string
  roleProfileJson: string
  trainingPurpose: string
  roundLimit: number
  stagesJson: string
  scoringRulesJson: string
}

const selectedFile = ref<File | null>(null)
const sourceType = ref('lms_case')
const profileType = ref(DEFAULT_CUSTOMER_PROFILE_TYPE)
const uploadResult = ref<TrainingKnowledgeUploadResponse | null>(null)
const chunks = ref<TrainingKnowledgeChunkResponse[]>([])
const trainingBatches = ref<TrainingKnowledgeBatchResponse[]>([])
const batchTotal = ref(0)
const batchPage = ref(1)
const activeBatchId = ref('')
const loadingBatches = ref(false)
const loadingChunks = ref(false)
const trainingPreview = ref<TrainingKnowledgePreviewResponse | null>(null)
const trainingPreviewVisible = ref(false)
const versionDialogVisible = ref(false)
const versionLoading = ref(false)
const batchVersions = ref<TrainingKnowledgeBatchResponse[]>([])
const activeVersionGroupId = ref('')
const activeChunkSummary = ref<ChunkTypeSummary | null>(null)
const chunkDetailVisible = ref(false)
const previewingBatchId = ref('')
const deletingBatchId = ref('')
const supplementDialogVisible = ref(false)
const supplementQuestions = ref<TrainingSupplementQuestion[]>([])
const supplementAnswers = ref<Record<string, string>>({})
const supplementOtherAnswers = ref<Record<string, string>>({})
const generatingSupplementQuestions = ref(false)

const traineeId = ref('trainee-001')
const traineeName = ref('销售学员')
const positionRole = ref('overseas_bd')
const experienceLevel = ref('junior')
const taskGoal = ref('goal_junior')
const weaknessTagsValue = ref<string[]>(['price_negotiation', 'demand_mining'])
const studentPortraitOther = ref('')
const modelMode = ref('high')
const scenarioDescription = ref('客户正在评估新的业务增长方案，但担心成本投入、交付风险和团队执行压力。')
const extraDetails = ref('学员需要通过提问挖掘客户真实顾虑，并用案例化表达争取客户愿意继续沟通。')

const planName = ref('')
const activePlan = ref<TrainingPlanSummaryResponse | null>(null)
const trainingPlans = ref<TrainingPlanSummaryResponse[]>([])
const planTotal = ref(0)
const planPage = ref(1)
const planKeyword = ref('')
const selectedPlanDetail = ref<TrainingPlanDetailResponse | null>(null)
const planDetailVisible = ref(false)
const planEditVisible = ref(false)
const planEditAdvancedPanels = ref<string[]>([])
const planEditDraft = ref<PlanEditDraft>(createEmptyPlanEditDraft())

const roleResult = ref<TrainingRoleGenerateResponse | null>(null)
const goalSetting = ref<TrainingGoalSettingResponse | null>(null)
const activeSession = ref<TrainingSessionResponse | null>(null)
const scoreResult = ref<TrainingScoreResponse | null>(null)
const trainingHistories = ref<TrainingSessionSummaryResponse[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const isReviewMode = ref(false)
const responseMode = ref<TrainingResponseMode>('stream')
const traineeMessage = ref('')
const messages = ref<TrainingMessage[]>([])
const retrievedChunkIds = ref<string[]>([])
const stageStatus = ref('未开始')
const trainingWindow = ref<HTMLElement | null>(null)
const activeWorkspaceTab = ref<TrainingWorkspaceTab>('setup')
const activeSetupTab = ref<SetupFlowTab>('plan')

const uploading = ref(false)
const publishingBatchId = ref('')
const rollingBackBatchId = ref('')
const reparsingBatchId = ref('')
const generatingRole = ref(false)
const generatingGoal = ref(false)
const startingSession = ref(false)
const submittingTurn = ref(false)
const scoring = ref(false)
const loadingHistory = ref(false)
const loadingDetail = ref(false)
const polishingScenario = ref(false)
const creatingPlan = ref(false)
const loadingPlans = ref(false)
const savingPlanEdit = ref(false)
const deletingPlanId = ref('')

const weaknessTags = computed(() => weaknessTagsValue.value.filter(Boolean))
const currentUploadChunkCount = computed(() => uploadResult.value?.chunk_count ?? 0)
const currentUploadPointCount = computed(() => uploadResult.value?.point_count ?? 0)
const currentUploadStatus = computed(() => batchStatusLabel(uploadResult.value?.status || 'waiting'))
const currentUploadDuplicateText = computed(() => uploadResult.value?.duplicate_of ? '已复用' : '未重复')
const canClearUploadArea = computed(() => Boolean(selectedFile.value || uploadResult.value))
const uploadQualityReport = computed(() => uploadResult.value?.quality_report || {})
const uploadQualityWarnings = computed(() => safeList(uploadQualityReport.value.warnings))
const uploadQualityMetrics = computed(() => (uploadQualityReport.value.metrics || {}) as Record<string, unknown>)
const uploadQualitySplitText = computed(() => {
  const splitter = String(uploadQualityReport.value.selected_splitter || '')
  if (splitter === 'llm_fallback') return 'LLM 兜底切分'
  if (uploadQualityReport.value.llm_fallback_attempted) return '规则切分，已尝试 LLM 兜底'
  return '规则配置切分'
})
const uploadPublishValidation = computed(() => (
  uploadQualityReport.value.publish_validation || null
) as Record<string, unknown> | null)
const canOpenRoleSetup = computed(() => Boolean(activePlan.value))
const canOpenStageSetup = computed(() => Boolean(roleResult.value))
const canOpenScoreSetup = computed(() => Boolean(goalSetting.value))
const planFlowStatusText = computed(() => activePlan.value ? '已创建' : '待创建')
const roleFlowStatusText = computed(() => {
  if (!activePlan.value) return '先建名称'
  return roleResult.value ? '已生成' : '待生成'
})
const stageFlowStatusText = computed(() => goalSetting.value ? `${goalSetting.value.round_limit} 轮` : roleResult.value ? '待生成' : '先生成角色')
const scoreFlowStatusText = computed(() => goalSetting.value ? '100 分' : '先生成训练阶段')
const canGoPreviousSetupStep = computed(() => activeSetupTab.value !== 'plan')
// 左侧工作区导航：顶部单独承载资料管理，左侧聚焦训练方案、陪练和复盘主流程。
const trainingWorkspaceNavItems = computed(() => [
  {
    key: 'setup' as TrainingWorkspaceTab,
    title: '训练方案',
    desc: '训练名称、画像、角色、目标和评分',
    value: activePlan.value ? activePlan.value.plan_name : '待创建',
    status: goalSetting.value ? '已完成' : roleResult.value ? '角色已生成' : activePlan.value ? '配置中' : '未开始',
    icon: Radar,
    ready: Boolean(goalSetting.value),
  },
  {
    key: 'chat' as TrainingWorkspaceTab,
    title: '实战陪练',
    desc: '和 AI 客户进行流式销售对话',
    value: activeSession.value ? `${answeredRounds.value}/${goalSetting.value?.round_limit || '-'} 轮` : '待开始',
    status: activeSession.value ? stageStatus.value : '未开始',
    icon: MessageSquareText,
    ready: Boolean(activeSession.value),
  },
  {
    key: 'review' as TrainingWorkspaceTab,
    title: '训练复盘',
    desc: '查看历史训练、评分和改进建议',
    value: scoreResult.value ? `${scoreResult.value.total_score} 分` : historyTotal.value ? `${historyTotal.value} 场` : '暂无',
    status: scoreResult.value ? '已评分' : historyTotal.value ? '有历史' : '未评分',
    icon: Trophy,
    ready: historyTotal.value > 0 || Boolean(scoreResult.value),
  },
])
const chunkTypeSummaries = computed<ChunkTypeSummary[]>(() => {
  const summaryMap = new Map<string, ChunkTypeSummary>()
  for (const chunk of chunks.value) {
    const label = casePartLabel(chunk.case_part)
    const usageLabel = chunkUsageLabel(chunk.visibility)
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
const activeChunkTypeChunks = computed(() => {
  const summary = activeChunkSummary.value
  if (!summary) return []
  return chunks.value.filter((chunk) => chunk.case_part === summary.casePart)
})
const answeredRounds = computed(() => messages.value.filter((item) => item.role === 'trainee').length)
const progressPercent = computed(() => {
  const roundLimit = goalSetting.value?.round_limit || 0
  if (!roundLimit) return 0
  return Math.min(100, Math.round((answeredRounds.value / roundLimit) * 100))
})
const trainingReadinessPercent = computed(() => {
  const readyItems = [
    batchTotal.value > 0,
    Boolean(activePlan.value),
    Boolean(roleResult.value),
    Boolean(goalSetting.value),
    Boolean(activeSession.value || scoreResult.value),
  ].filter(Boolean).length
  return Math.round((readyItems / 5) * 100)
})
const nextTrainingAction = computed<TrainingNextAction>(() => {
  if (batchTotal.value === 0) {
    return {
      title: '先准备训练资料',
      detail: '上传 LMS 案例或销售资料，系统会写入训练向量库，后续生成角色和目标时可直接引用。',
      actionText: '去管理资料',
      tab: 'knowledge',
    }
  }
  if (!activePlan.value) {
    return {
      title: '设置训练名称',
      detail: '先创建或选择本次训练名称，再进入学员画像、客户画像和场景配置。',
      actionText: '去设置名称',
      tab: 'setup',
      setupTab: 'plan',
    }
  }
  if (!roleResult.value) {
    return {
      title: '生成 AI 客户角色',
      detail: '根据当前画像和场景生成可对话客户，先确认角色，再进入训练阶段设置。',
      actionText: '去生成角色',
      tab: 'setup',
      setupTab: 'role',
    }
  }
  if (!goalSetting.value) {
    return {
      title: '生成训练阶段',
      detail: '把角色转成明确的训练目标、轮次和推进节奏，让陪练有清晰边界。',
      actionText: '去生成阶段',
      tab: 'setup',
      setupTab: 'stage',
    }
  }
  if (!activeSession.value) {
    return {
      title: '开始实战陪练',
      detail: '当前角色和阶段已经就绪，可以进入对话训练，系统会保留训练过程用于复盘。',
      actionText: '去开始训练',
      tab: 'chat',
    }
  }
  if (!scoreResult.value && answeredRounds.value > 0) {
    return {
      title: '生成训练复盘',
      detail: '对已经完成的对话生成评分、优势、短板和下一轮训练建议。',
      actionText: '去训练复盘',
      tab: 'review',
    }
  }
  return {
    title: '查看训练结果',
    detail: '本轮训练已经形成结果，可以回看历史会话，也可以基于同一画像继续新一轮训练。',
    actionText: '查看复盘',
    tab: 'review',
  }
})

const customerProfileTemplates = ref<DictionaryItemResponse[]>([])
const customerProfileValues = ref<Record<string, ProfileFieldValue>>({})
const traineePortraitItems = ref<DictionaryItemResponse[]>([])
const sourceTypeItems = ref<DictionaryItemResponse[]>([])
const casePartItems = ref<DictionaryItemResponse[]>([])
const chunkUsageItems = ref<DictionaryItemResponse[]>([])
const loadingProfileDictionaries = ref(false)
const traineeProfileDialogVisible = ref(false)
const customerProfileDialogVisible = ref(false)
const traineeProfileDraft = ref<TraineeProfileDraft>({
  traineeId: traineeId.value,
  traineeName: traineeName.value,
  positionRole: positionRole.value,
  experienceLevel: experienceLevel.value,
  taskGoal: taskGoal.value,
  weaknessTags: [...weaknessTagsValue.value],
  studentPortraitOther: studentPortraitOther.value,
})
const draftProfileType = ref(profileType.value)
const draftCustomerProfileValues = ref<Record<string, ProfileFieldValue>>({})
const draftScenarioDescription = ref(scenarioDescription.value)
const draftExtraDetails = ref(extraDetails.value)
const draftModelMode = ref(modelMode.value)
const publicProfileSources = computed(() => compactProfileSources([
  roleResult.value?.role_confirm_card,
  roleResult.value?.visible_profile,
  roleResult.value?.role_profile,
]))
const hiddenProfileSources = computed(() => compactProfileSources([
  roleResult.value?.hidden_profile,
  roleResult.value?.role_profile,
]))
const roleTitleText = computed(() => displayValue(profileValue(publicProfileSources.value, ['角色名称', 'role_name', '客户类型', 'customer_type']) || 'AI 客户'))
const roleSummaryText = computed(() => displayValue(profileValue(publicProfileSources.value, ['角色摘要', 'role_summary', '角色简介', 'company_context', '公司背景']) || '客户画像已生成，可在下方查看完整角色背景、痛点、异议和追问策略。'))
const roleConfirmMetaText = computed(() => {
  const gender = displayValue(profileValue(publicProfileSources.value, ['性别', 'gender']) || customerProfileDisplayPayload.value.性别 || '男')
  const age = displayValue(profileValue(publicProfileSources.value, ['年龄', 'age']) || '')
  const position = displayValue(profileValue(publicProfileSources.value, ['职位', 'position', '身份', 'identity']) || '业务负责人')
  return [gender, age && `${age}岁`, position].filter(Boolean).join(' · ')
})
const rolePersonalityText = computed(() => displayValue(profileValue(publicProfileSources.value, ['性格特征', 'personality']) || '务实谨慎，关注投入产出和风险边界'))
const roleCostHabitList = computed(() => valueList(profileValue(publicProfileSources.value, ['成本控制习惯', 'cost_control_habit'])))
const roleBusinessPainList = computed(() => valueList(profileValue(publicProfileSources.value, ['核心痛点', '业务痛点', 'business_pain_points', '当前工作痛点'])))
const roleSubtextList = computed(() => valueList(profileValue(hiddenProfileSources.value, ['潜台词', '真实顾虑', '未明说动机', 'implicit_subtext'])))
const roleIdentityFields = computed(() => profileFields([
  { label: '身份', keys: ['身份', 'identity', '职位', 'position'] },
  { label: '客户类型', keys: ['客户类型', 'customer_type'] },
  { label: '行业', keys: ['行业', 'industry'] },
  { label: '公司背景', keys: ['公司背景', 'company_context'] },
  { label: '合作阶段', keys: ['合作阶段', 'cooperation_stage'] },
  { label: '价格敏感度', keys: ['价格敏感度', 'price_sensitivity'] },
], publicProfileSources.value))
const selectedProfileTemplate = computed(() => (
  customerProfileTemplates.value.find((item) => item.item_code === profileType.value)
    || customerProfileTemplates.value[0]
    || null
))
const activeCustomerProfileFields = computed(() => customerProfileFieldsFromTemplate(
  selectedProfileTemplate.value,
  customerProfileValues.value,
))
const customerProfilePayload = computed<Record<string, ProfileFieldValue>>(() => {
  const payload: Record<string, ProfileFieldValue> = {}
  for (const field of activeCustomerProfileFields.value) {
    payload[field.fieldKey] = customerProfileValues.value[field.fieldKey] || field.defaultValue
  }
  return payload
})
const customerProfileDisplayPayload = computed<Record<string, string>>(() => {
  const payload: Record<string, string> = {}
  for (const field of activeCustomerProfileFields.value) {
    const value = customerProfileValues.value[field.fieldKey] || field.defaultValue
    payload[field.label] = customerFieldDisplayValue(field, value)
  }
  return payload
})
const draftSelectedProfileTemplate = computed(() => (
  customerProfileTemplates.value.find((item) => item.item_code === draftProfileType.value)
    || selectedProfileTemplate.value
    || customerProfileTemplates.value[0]
    || null
))
const draftCustomerProfileFields = computed(() => customerProfileFieldsFromTemplate(
  draftSelectedProfileTemplate.value,
  draftCustomerProfileValues.value,
))
const draftCustomerProfileDisplayPayload = computed<Record<string, string>>(() => {
  const payload: Record<string, string> = {}
  for (const field of draftCustomerProfileFields.value) {
    const value = draftCustomerProfileValues.value[field.fieldKey] || field.defaultValue
    payload[field.label] = customerFieldDisplayValue(field, value)
  }
  return payload
})
const selectedProfileScenario = computed(() => String(selectedProfileTemplate.value?.metadata?.scenario_summary || '按客户画像字典动态生成字段'))
const draftProfileScenario = computed(() => String(draftSelectedProfileTemplate.value?.metadata?.scenario_summary || '按客户画像字典动态生成字段'))
const draftCustomerProfileFieldGroups = computed(() => groupCustomerProfileFields(draftCustomerProfileFields.value))
const planEditSelectedProfileTemplate = computed(() => (
  customerProfileTemplates.value.find((item) => item.item_code === planEditDraft.value.profileType)
    || selectedProfileTemplate.value
    || customerProfileTemplates.value[0]
    || null
))
const planEditCustomerProfileFields = computed(() => customerProfileFieldsFromTemplate(
  planEditSelectedProfileTemplate.value,
  planEditDraft.value.customerProfileValues,
))
const planEditCustomerProfileDisplayPayload = computed<Record<string, string>>(() => {
  const payload: Record<string, string> = {}
  for (const field of planEditCustomerProfileFields.value) {
    const value = planEditDraft.value.customerProfileValues[field.fieldKey] || field.defaultValue
    payload[field.label] = customerFieldDisplayValue(field, value)
  }
  return payload
})
const planEditCustomerProfileFieldGroups = computed(() => groupCustomerProfileFields(planEditCustomerProfileFields.value))
const planEditProfileScenario = computed(() => String(planEditSelectedProfileTemplate.value?.metadata?.scenario_summary || '按客户画像字典动态生成字段'))
const positionRoleOptions = computed(() => traineePortraitOptions('position_role'))
const experienceLevelOptions = computed(() => traineePortraitOptions('experience_level'))
const taskGoalOptions = computed(() => traineePortraitOptions('task_goal'))
const weaknessTagOptions = computed(() => traineePortraitOptions('weakness_tag'))
const sourceTypeOptions = computed(() => {
  const options = sourceTypeItems.value
    .filter((item) => item.enabled)
    .map((item) => ({
      label: item.item_name,
      value: item.item_code,
    }))
  return options.length ? options : FALLBACK_SOURCE_TYPE_OPTIONS
})
const selectedSourceTypeItem = computed(() => (
  sourceTypeItems.value.find((item) => item.enabled && item.item_code === sourceType.value) || null
))
const sourceTypeDescription = computed(() => {
  const item = selectedSourceTypeItem.value
  if (!item) return '当前按 LMS 销售训练案例做专门结构化拆分。'
  const strategy = String(item.metadata?.strategy || '')
  return [item.description, strategy ? `策略：${strategy}` : ''].filter(Boolean).join(' · ')
})
const uploadHelpDescription = computed(() => (
  `一期上传只做文件入库，画像、行业、难度和评分规则不在上传阶段配置。${sourceTypeDescription.value}`
))
const positionRoleLabel = computed(() => traineeOptionLabel('position_role', positionRole.value))
const draftPositionRoleLabel = computed(() => traineeOptionLabel('position_role', traineeProfileDraft.value.positionRole))
const experienceLevelLabel = computed(() => traineeOptionLabel('experience_level', experienceLevel.value))
const draftExperienceLevelLabel = computed(() => traineeOptionLabel('experience_level', traineeProfileDraft.value.experienceLevel))
const taskGoalLabel = computed(() => traineeOptionLabel('task_goal', taskGoal.value))
const draftTaskGoalLabel = computed(() => traineeOptionLabel('task_goal', traineeProfileDraft.value.taskGoal))
const weaknessTagLabels = computed(() => weaknessTags.value.map((tag) => traineeOptionLabel('weakness_tag', tag)))
const draftWeaknessTagLabels = computed(() => traineeProfileDraft.value.weaknessTags.map((tag) => traineeOptionLabel('weakness_tag', tag)))
const modelModeLabel = computed(() => displayOptionLabel(modelMode.value, {
  high: '高质量',
  medium: '均衡',
  low: '低延迟',
}))
const traineeProfileTags = computed(() => uniqueList([
  `学员：${traineeName.value}`,
  `职位：${positionRoleLabel.value}`,
  `经验：${experienceLevelLabel.value}`,
  `任务目标：${taskGoalLabel.value}`,
  ...weaknessTagLabels.value.map((label) => `短板标签：${label}`),
  studentPortraitOther.value ? `其他：${studentPortraitOther.value}` : '',
]))
const customerProfileTags = computed(() => {
  const fieldValues = activeCustomerProfileFields.value.flatMap((field) => {
    const value = customerFieldDisplayValue(field, customerProfilePayload.value[field.fieldKey])
    return valueList(value).map((item) => `${field.label}：${item}`)
  })
  return uniqueList(fieldValues).slice(0, 18)
})
const scenarioPreviewText = computed(() => compactText(scenarioDescription.value))
const extraDetailsPreviewText = computed(() => compactText(extraDetails.value || '未填写'))
const goalStage = computed(() => goalSetting.value?.stages?.[0])
const report = computed(() => scoreResult.value?.report || {})
const scoringRules = computed(() => goalSetting.value?.scoring_rules || {})
const generalScoringDimensions = computed(() => asArray(scoringRules.value.general_dimensions))
const stageScoringDimensions = computed(() => expandStageScoringDimensions(asArray(scoringRules.value.stage_dimensions)))
const chatRoleFields = computed(() => roleIdentityFields.value.slice(0, 6))
const latestCoachAnalysis = computed(() => {
  const last = [...messages.value].reverse().find((item) => hasDisplayValue(item.analysis))
  return last?.analysis || {}
})

function compactProfileSources(values: Array<Record<string, unknown> | null | undefined>): Record<string, unknown>[] {
  return values.filter((item): item is Record<string, unknown> => Boolean(item) && hasDisplayValue(item))
}

function profileValue(sources: Record<string, unknown>[], keys: string[]): unknown {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key]
      if (hasDisplayValue(value)) return value
    }
  }
  return ''
}

function profileFields(configs: ProfileFieldConfig[], sources: Record<string, unknown>[]): ProfileField[] {
  return configs
    .map<ProfileField>((config) => ({ label: config.label, value: profileValue(sources, config.keys) }))
    .filter((field) => hasDisplayValue(field.value))
}

function scorePoints(value: unknown): Record<string, unknown>[] {
  return asArray((value as Record<string, unknown> | undefined)?.points)
}

// 创建训练方案编辑草稿，避免详情页和新增页状态互相污染。
function createEmptyPlanEditDraft(): PlanEditDraft {
  return {
    planName: '',
    traineeId: '',
    traineeName: '',
    positionRole: '',
    experienceLevel: '',
    taskGoal: '',
    weaknessTags: [],
    studentPortraitOther: '',
    profileType: DEFAULT_CUSTOMER_PROFILE_TYPE,
    customerProfileValues: {},
    scenarioDescription: '',
    extraDetails: '',
    modelMode: 'high',
    roleConfirmCardJson: '{}',
    visibleProfileJson: '{}',
    hiddenProfileJson: '{}',
    roleProfileJson: '{}',
    trainingPurpose: '',
    roundLimit: 0,
    stagesJson: '[]',
    scoringRulesJson: '{}',
  }
}

// 把对象序列化成稳定可读的 JSON，供高级配置区编辑复杂结构。
function toPrettyJson(value: unknown, fallback: unknown) {
  const source = hasDisplayValue(value) ? value : fallback
  return JSON.stringify(source, null, 2)
}

// 解析高级配置 JSON，带上字段名便于用户定位格式错误。
function parseJsonField<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T
  } catch {
    throw new Error(`${label} JSON 格式不正确`)
  }
}

// 为详情页过滤出真正的客户画像字段，隐藏内部组合字段。
function planDetailCustomerEntries(detail: TrainingPlanDetailResponse): Array<[string, unknown]> {
  return objectEntries(detail.selected_fields).filter(([key]) => !['画像类型', '学员画像'].includes(key))
}

// 获取训练方案保存时使用的客户画像模板中文名。
function planDetailProfileTemplateName(detail: TrainingPlanDetailResponse): string {
  return displayValue(
    detail.selected_fields.画像类型
      || customerProfileTemplates.value.find((item) => item.item_code === detail.plan.profile_type)?.item_name
      || detail.plan.profile_type,
  )
}

// 获取训练方案保存时使用的学员名称。
function planDetailTraineeName(detail: TrainingPlanDetailResponse): string {
  return displayValue(detail.trainee.trainee_name || detail.plan.trainee_name || '销售学员')
}

// 获取训练方案保存时使用的学员角色标签。
function planDetailTraineeRole(detail: TrainingPlanDetailResponse): string {
  return traineeOptionLabel('position_role', String(detail.trainee.position_role || ''))
}

// 生成详情页学员画像展示项，统一把编码转成字典中文名。
function planDetailTraineeItems(detail: TrainingPlanDetailResponse): ProfileField[] {
  const trainee = detail.trainee
  const weaknessValues = Array.isArray(trainee.weakness_tags) ? trainee.weakness_tags.map(String) : []
  return [
    { label: '学员编号', value: trainee.trainee_id },
    { label: '学员名称', value: trainee.trainee_name },
    { label: '职位角色', value: traineeOptionLabel('position_role', String(trainee.position_role || '')) },
    { label: '经验等级', value: traineeOptionLabel('experience_level', String(trainee.experience_level || '')) },
    { label: '任务目标', value: traineeOptionLabel('task_goal', String(trainee.task_goal || '')) },
    { label: '短板标签', value: weaknessValues.map((tag) => traineeOptionLabel('weakness_tag', tag)) },
    { label: '其他说明', value: trainee.student_portrait_other || '无' },
  ].filter((item) => hasDisplayValue(item.value))
}

// 获取详情页所有训练阶段，兼容后端未生成阶段的情况。
function planDetailStages(detail: TrainingPlanDetailResponse): Record<string, unknown>[] {
  return asArray(detail.goal_setting?.stages)
}

// 获取详情页通用评分维度。
function planDetailGeneralDimensions(detail: TrainingPlanDetailResponse): Record<string, unknown>[] {
  return asArray(detail.goal_setting?.scoring_rules?.general_dimensions)
}

// 获取详情页阶段评分维度，不足时沿用页面里的兜底展示规则。
function planDetailStageDimensions(detail: TrainingPlanDetailResponse): Record<string, unknown>[] {
  return expandStageScoringDimensions(asArray(detail.goal_setting?.scoring_rules?.stage_dimensions))
}

// 详情页展示检索案例时优先识别常见字段，字段缺失时仍保留摘要。
function planCaseTitle(item: Record<string, unknown>, index: number) {
  return displayValue(item.source_file || item.case_title || item.title || item.file_name || `案例 ${index + 1}`)
}

// 详情页展示检索案例摘要，避免整段 JSON 淹没页面。
function planCaseSummary(item: Record<string, unknown>) {
  return displayValue(item.content || item.chunk_text || item.text || item.summary || item)
}

function expandStageScoringDimensions(dimensions: Record<string, unknown>[]): Record<string, unknown>[] {
  if (dimensions.length >= 3 && dimensions.every((dimension) => scorePoints(dimension).length >= 3)) {
    return dimensions
  }

  const sourcePoints = dimensions.flatMap((dimension) => scorePoints(dimension))
  const fallbackPoints = sourcePoints.length >= 3
    ? sourcePoints
    : [
        { point_name: '痛点挖掘', score: 20, description: '能围绕客户业务问题追问真实痛点和需求方向。' },
        { point_name: '证据提供', score: 20, description: '能提供案例、数据或方案依据，打消客户疑虑。' },
        { point_name: '异议处理', score: 20, description: '能回应客户异议，并推动进入下一步沟通。' },
      ]

  return [
    {
      dimension_name: '需求挖掘与痛点确认',
      score: 20,
      points: fallbackPoints.slice(0, 3).map((point, index) => ({
        ...point,
        score: [7, 7, 6][index],
      })),
    },
    {
      dimension_name: '价值呈现与证据支撑',
      score: 20,
      points: [
        { point_name: '价值匹配', score: 7, description: '能把方案价值和客户已表达痛点建立清晰连接。' },
        { point_name: '证据支撑', score: 7, description: '能引用案例、数据、流程或知识库事实支撑表达。' },
        { point_name: '风险降低', score: 6, description: '能说明试点、验证路径或落地方式，降低客户顾虑。' },
      ],
    },
    {
      dimension_name: '异议处理与推进动作',
      score: 20,
      points: [
        { point_name: '异议承接', score: 7, description: '面对价格、风险、交付等异议时先承接再回应。' },
        { point_name: '针对回应', score: 7, description: '能根据客户具体异议给出对应解释。' },
        { point_name: '下一步推进', score: 6, description: '能争取客户继续沟通、试点、提供资料或约定下次联系。' },
      ],
    },
  ]
}

function customerProfileFieldFromDictionary(item: DictionaryItemResponse): CustomerProfileField {
  const metadata = item.metadata || {}
  const childOptions: DictionaryOption[] = item.children
    .filter((child) => child.enabled)
    .map((child) => ({
      label: child.item_name,
      value: child.item_code,
    }))
  const metadataOptions = Array.isArray(metadata.options)
    ? metadata.options.map((option) => ({ label: String(option), value: String(option) }))
    : []
  const options = childOptions.length ? childOptions : metadataOptions
  return {
    itemCode: item.item_code,
    label: item.item_name,
    description: item.description || '',
    fieldKey: String(metadata.field_key || metadata.field_code || item.item_name),
    inputType: String(metadata.input_type || (options.length ? 'select' : 'text')),
    defaultValue: String(metadata.default_value || options[0]?.value || ''),
    options,
  }
}

function customerProfileFieldsFromTemplate(
    template: DictionaryItemResponse | null,
    values: Record<string, ProfileFieldValue>,
): CustomerProfileField[] {
  return (template?.children || [])
    .filter((item) => item.enabled)
    .map(customerProfileFieldFromDictionary)
    .filter((field) => isCustomerFieldVisible(field, template?.item_code || '', values))
}

function customerFieldDisplayValue(field: CustomerProfileField, value: ProfileFieldValue): string {
  if (Array.isArray(value)) {
    return value.map((item) => customerFieldDisplayValue(field, item)).filter(Boolean).join('、')
  }
  return field.options.find((option) => option.value === value)?.label || value
}

function isCustomerFieldVisible(
    field: CustomerProfileField,
    templateCode: string,
    values: Record<string, ProfileFieldValue>,
): boolean {
  if (templateCode !== 'overseas_bd') return true
  const serviceContent = String(values.overseas_bd_service_content || '')
  const customerCategory = String(values.overseas_bd_customer_category || '')

  if (field.fieldKey === 'overseas_bd_normal_intention_cooperation_stage') {
    return customerCategory === 'overseas_bd_category_normal_intention_customer'
  }
  if (field.fieldKey === 'overseas_bd_medium_intention_cooperation_stage') {
    return customerCategory === 'overseas_bd_category_medium_intention_customer'
  }
  if (field.fieldKey === 'overseas_bd_high_intention_cooperation_stage') {
    return customerCategory === 'overseas_bd_category_high_intention_customer'
  }
  if (field.fieldKey === 'overseas_bd_service_content') {
    return true
  }
  if (OVERSEAS_BD_PRODUCT_FOCUS_FIELDS.has(field.fieldKey)) {
    return !serviceContent || serviceContent === 'overseas_bd_service_content_product'
  }
  if (OVERSEAS_BD_SERVICE_FOCUS_FIELDS.has(field.fieldKey)) {
    return !serviceContent || serviceContent === 'overseas_bd_service_content_service'
  }
  return true
}

function groupCustomerProfileFields(fields: CustomerProfileField[]): CustomerProfileFieldGroup[] {
  const groups: CustomerProfileFieldGroup[] = [
    { title: '客户基础信息', fields: [] },
    { title: '阶段与来源', fields: [] },
    { title: '关注点与价格', fields: [] },
    { title: '产品与服务', fields: [] },
    { title: '决策人与性格', fields: [] },
    { title: '补充信息', fields: [] },
  ]
  const append = (index: number, field: CustomerProfileField) => groups[index].fields.push(field)

  for (const field of fields) {
    const key = field.fieldKey
    if (
      key.includes('type')
      || key.includes('category')
      || key.includes('location')
      || key.includes('industry')
      || key.includes('company_size')
      || key.includes('trade_experience')
    ) {
      append(0, field)
    } else if (
      key.includes('stage')
      || key.includes('phase')
      || key.includes('source')
      || key.includes('intention')
    ) {
      append(1, field)
    } else if (
      key.includes('focus')
      || key.includes('concern')
      || key.includes('sensitivity')
    ) {
      append(2, field)
    } else if (
      key.includes('product')
      || key.includes('service_content')
      || key.includes('applicable')
    ) {
      append(3, field)
    } else if (
      key.includes('decision')
      || key.includes('personality')
      || key.includes('gender')
      || key.includes('age')
      || key.includes('training_scene')
    ) {
      append(4, field)
    } else {
      append(5, field)
    }
  }

  const displayGroups = [
    groups[0],
    groups[1],
    groups[3],
    groups[2],
    groups[4],
    groups[5],
  ]
  return displayGroups.filter((group) => group.fields.length > 0)
}

function isMultiSelectField(field: CustomerProfileField): boolean {
  return field.inputType === 'multi_select' || field.label.includes('关注点')
}

function isTextAreaField(field: CustomerProfileField): boolean {
  return field.inputType === 'textarea' || field.label.includes('其他')
}

function dictionaryOptions(item: DictionaryItemResponse | undefined): DictionaryOption[] {
  return (item?.children || [])
    .filter((child) => child.enabled)
    .map((child) => ({
      label: child.item_name,
      value: child.item_code,
    }))
}

function traineePortraitField(fieldCode: string): DictionaryItemResponse | undefined {
  return traineePortraitItems.value.find((item) => item.item_code === fieldCode)
}

function traineePortraitOptions(fieldCode: string): DictionaryOption[] {
  return dictionaryOptions(traineePortraitField(fieldCode))
}

function traineeOptionLabel(fieldCode: string, value: string): string {
  const option = traineePortraitOptions(fieldCode).find((item) => item.value === value)
  return option?.label || value
}

function dictionaryItemLabel(items: DictionaryItemResponse[], code: string, fallbackLabels: Record<string, string>) {
  const item = items.find((option) => option.item_code === code)
  return item?.item_name || fallbackLabels[code] || code
}

function dictionaryItemDescription(items: DictionaryItemResponse[], code: string) {
  return items.find((option) => option.item_code === code)?.description || ''
}

function casePartLabel(code: string) {
  return dictionaryItemLabel(casePartItems.value, code, {
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

function chunkUsageLabel(code: string) {
  return dictionaryItemLabel(chunkUsageItems.value, code, {
    visible: '通用知识',
    hidden: '客户内部顾虑',
    scoring_only: '评分专用',
  })
}

function batchStatusLabel(code: string) {
  return dictionaryItemLabel([], code, {
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

function qualityLevelLabel(level: unknown) {
  return displayOptionLabel(String(level || ''), {
    good: '质量较好',
    review: '建议复核',
    poor: '质量较低',
  })
}

function qualityLevelClass(level: unknown) {
  const value = String(level || '')
  if (value === 'good') return 'good'
  if (value === 'poor') return 'poor'
  return 'review'
}

function chunkSummaryTitle(summary: ChunkTypeSummary) {
  const partDescription = dictionaryItemDescription(casePartItems.value, summary.casePart)
  return [
    `切片类型编码：${summary.casePart}`,
    partDescription && `类型说明：${partDescription}`,
    `包含分片：${summary.count} 条`,
    `模型用途：${summary.usageLabels.join('、')}`,
  ].filter(Boolean).join('\n')
}

// 打开某一类训练知识切片详情，按当前切片顺序展示全部内容。
function openChunkSummaryDetail(summary: ChunkTypeSummary) {
  activeChunkSummary.value = summary
  chunkDetailVisible.value = true
}

// 生成切片详情里的辅助信息，方便确认来源、用途和结构化元数据。
function chunkDetailMeta(chunk: TrainingKnowledgeChunkResponse, index: number) {
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
    `用途：${chunkUsageLabel(chunk.visibility)}`,
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

function firstOptionValue(fieldCode: string, fallback: string): string {
  return traineePortraitOptions(fieldCode)[0]?.value || fallback
}

function syncTraineePortraitDefaults() {
  const positionOptions = traineePortraitOptions('position_role')
  const experienceOptions = traineePortraitOptions('experience_level')
  const taskGoalOptions = traineePortraitOptions('task_goal')
  const weaknessOptions = traineePortraitOptions('weakness_tag')

  if (positionOptions.length && !positionOptions.some((item) => item.value === positionRole.value)) {
    positionRole.value = firstOptionValue('position_role', DEFAULT_CUSTOMER_PROFILE_TYPE)
  }
  if (experienceOptions.length && !experienceOptions.some((item) => item.value === experienceLevel.value)) {
    experienceLevel.value = firstOptionValue('experience_level', 'junior')
  }
  if (taskGoalOptions.length && !taskGoalOptions.some((item) => item.value === taskGoal.value)) {
    taskGoal.value = firstOptionValue('task_goal', 'goal_junior')
  }
  if (weaknessOptions.length) {
    const validWeaknessValues = new Set(weaknessOptions.map((item) => item.value))
    weaknessTagsValue.value = weaknessTagsValue.value.filter((tag) => validWeaknessValues.has(tag))
    if (weaknessTagsValue.value.length === 0) {
      weaknessTagsValue.value = weaknessOptions.slice(0, 2).map((item) => item.value)
    }
  }
}

function syncSourceTypeDefault() {
  if (sourceTypeOptions.value.some((option) => option.value === sourceType.value)) return
  sourceType.value = sourceTypeOptions.value[0]?.value || 'lms_case'
}

function syncDraftCustomerProfileDefaults() {
  for (const field of draftCustomerProfileFields.value) {
    if (!draftCustomerProfileValues.value[field.fieldKey]) {
      draftCustomerProfileValues.value[field.fieldKey] = defaultCustomerFieldValue(field)
    }
  }
}

function syncCustomerProfileDefaults() {
  for (const field of activeCustomerProfileFields.value) {
    if (!customerProfileValues.value[field.fieldKey]) {
      customerProfileValues.value[field.fieldKey] = defaultCustomerFieldValue(field)
    }
  }
}

function defaultCustomerFieldValue(field: CustomerProfileField): ProfileFieldValue {
  if (isMultiSelectField(field)) {
    return field.defaultValue ? [field.defaultValue] : []
  }
  return field.defaultValue
}

function openTraineeProfileDialog() {
  traineeProfileDraft.value = {
    traineeId: traineeId.value,
    traineeName: traineeName.value,
    positionRole: positionRole.value,
    experienceLevel: experienceLevel.value,
    taskGoal: taskGoal.value,
    weaknessTags: [...weaknessTagsValue.value],
    studentPortraitOther: studentPortraitOther.value,
  }
  traineeProfileDialogVisible.value = true
}

function confirmTraineeProfileDialog() {
  traineeId.value = traineeProfileDraft.value.traineeId.trim() || 'trainee-001'
  traineeName.value = traineeProfileDraft.value.traineeName.trim() || '销售学员'
  positionRole.value = traineeProfileDraft.value.positionRole || firstOptionValue('position_role', DEFAULT_CUSTOMER_PROFILE_TYPE)
  experienceLevel.value = traineeProfileDraft.value.experienceLevel || 'junior'
  taskGoal.value = traineeProfileDraft.value.taskGoal || 'goal_junior'
  weaknessTagsValue.value = [...traineeProfileDraft.value.weaknessTags]
  studentPortraitOther.value = traineeProfileDraft.value.studentPortraitOther.trim()
  traineeProfileDialogVisible.value = false
}

function openCustomerProfileDialog() {
  draftProfileType.value = profileType.value
  draftCustomerProfileValues.value = { ...customerProfileValues.value }
  draftScenarioDescription.value = scenarioDescription.value
  draftExtraDetails.value = extraDetails.value
  draftModelMode.value = modelMode.value
  syncDraftCustomerProfileDefaults()
  customerProfileDialogVisible.value = true
}

function applyDraftProfileTemplate(templateCode: string) {
  draftProfileType.value = templateCode
  syncDraftCustomerProfileDefaults()
}

function confirmCustomerProfileDialog() {
  profileType.value = draftProfileType.value
  customerProfileValues.value = { ...draftCustomerProfileValues.value }
  scenarioDescription.value = draftScenarioDescription.value.trim()
  extraDetails.value = draftExtraDetails.value.trim()
  modelMode.value = draftModelMode.value
  syncCustomerProfileDefaults()
  customerProfileDialogVisible.value = false
}

function currentTraineePayload() {
  return {
    trainee_id: traineeId.value,
    trainee_name: traineeName.value,
    position_role: positionRole.value,
    experience_level: experienceLevel.value,
    task_goal: taskGoal.value,
    weakness_tags: weaknessTags.value,
    student_portrait_other: studentPortraitOther.value,
  }
}

function currentPlanPayload() {
  return {
    trainee: currentTraineePayload(),
    profile_type: profileType.value,
    selected_fields: {
      画像类型: selectedProfileTemplate.value?.item_name || profileType.value,
      学员画像: {
        职位角色: positionRoleLabel.value,
        经验等级: experienceLevelLabel.value,
        任务目标: taskGoalLabel.value,
        短板标签: weaknessTagLabels.value,
        其他: studentPortraitOther.value || '无',
      },
      ...customerProfileDisplayPayload.value,
    },
    scenario_description: scenarioDescription.value,
    extra_details: extraDetails.value,
    model_mode: modelMode.value,
  }
}

async function createPlanFromCurrentInput() {
  if (!planName.value.trim()) {
    ElMessage.warning('请先输入训练名称')
    return
  }
  if (!scenarioDescription.value.trim()) {
    ElMessage.warning('请填写训练场景描述')
    return
  }

  creatingPlan.value = true
  try {
    const detail = await createTrainingPlan({
      plan_name: planName.value.trim(),
      ...currentPlanPayload(),
    })
    hydratePlanDetail(detail)
    activeSetupTab.value = 'role'
    await refreshTrainingPlans()
    ElMessage.success('训练方案已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练方案创建失败')
  } finally {
    creatingPlan.value = false
  }
}

function hydratePlanDetail(detail: TrainingPlanDetailResponse) {
  activePlan.value = detail.plan
  selectedPlanDetail.value = detail
  planName.value = detail.plan.plan_name
  const trainee = detail.trainee
  traineeId.value = String(trainee.trainee_id || traineeId.value)
  traineeName.value = String(trainee.trainee_name || traineeName.value)
  positionRole.value = String(trainee.position_role || positionRole.value)
  experienceLevel.value = String(trainee.experience_level || experienceLevel.value)
  taskGoal.value = String(trainee.task_goal || taskGoal.value)
  weaknessTagsValue.value = Array.isArray(trainee.weakness_tags) ? trainee.weakness_tags.map(String) : weaknessTagsValue.value
  studentPortraitOther.value = String(trainee.student_portrait_other || '')
  profileType.value = detail.plan.profile_type
  restoreCustomerProfileValuesFromDisplay(detail.selected_fields)
  modelMode.value = detail.plan.model_mode || modelMode.value
  scenarioDescription.value = detail.scenario_description
  extraDetails.value = detail.extra_details
  roleResult.value = detail.plan.active_profile_id ? {
    profile_id: detail.plan.active_profile_id,
    visible_profile: detail.visible_profile,
    hidden_profile: detail.hidden_profile,
    role_profile: detail.role_profile,
    role_confirm_card: detail.role_confirm_card,
    hidden_summary: '方案已保存隐藏心理画像。',
    retrieved_cases: detail.retrieved_cases,
    knowledge_facts: detail.retrieved_cases.map((item) => String(item.content || '')).filter(Boolean).slice(0, 6),
  } : null
  goalSetting.value = detail.goal_setting || null
  scoreResult.value = null
}

function resetActiveTrainingPlanState() {
  activePlan.value = null
  selectedPlanDetail.value = null
  planDetailVisible.value = false
  planEditVisible.value = false
  roleResult.value = null
  goalSetting.value = null
  activeSession.value = null
  scoreResult.value = null
  messages.value = []
  retrievedChunkIds.value = []
  stageStatus.value = '未开始'
  isReviewMode.value = false
  activeSetupTab.value = 'plan'
}

function restoreCustomerProfileValuesFromDisplay(selectedFields: Record<string, unknown>) {
  const restored = { ...customerProfileValues.value }
  for (let pass = 0; pass < 2; pass += 1) {
    const fields = customerProfileFieldsFromTemplate(selectedProfileTemplate.value, restored)
    for (const field of fields) {
      const rawValue = selectedFields[field.label]
      if (!hasDisplayValue(rawValue)) continue
      const textValue = displayValue(rawValue)
      if (isMultiSelectField(field)) {
        const parts = textValue.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
        restored[field.fieldKey] = parts.map((item) => field.options.find((option) => option.label === item || option.value === item)?.value || item)
      } else if (field.options.length) {
        restored[field.fieldKey] = field.options.find((option) => option.label === textValue || option.value === textValue)?.value || textValue
      } else {
        restored[field.fieldKey] = textValue
      }
    }
  }
  customerProfileValues.value = restored
}

// 从训练方案详情里还原客户画像表单值，编辑弹窗使用独立副本。
function restoredCustomerProfileValuesForDetail(detail: TrainingPlanDetailResponse): Record<string, ProfileFieldValue> {
  const restored: Record<string, ProfileFieldValue> = { ...customerProfileValues.value }
  const template = customerProfileTemplates.value.find((item) => item.item_code === detail.plan.profile_type)
    || selectedProfileTemplate.value
  for (let pass = 0; pass < 2; pass += 1) {
    const fields = customerProfileFieldsFromTemplate(template, restored)
    for (const field of fields) {
      const rawValue = detail.selected_fields[field.label]
      if (!hasDisplayValue(rawValue)) continue
      const textValue = displayValue(rawValue)
      if (isMultiSelectField(field)) {
        const parts = textValue.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
        restored[field.fieldKey] = parts.map((item) => field.options.find((option) => option.label === item || option.value === item)?.value || item)
      } else if (field.options.length) {
        restored[field.fieldKey] = field.options.find((option) => option.label === textValue || option.value === textValue)?.value || textValue
      } else {
        restored[field.fieldKey] = textValue
      }
    }
  }
  return restored
}

// 切换编辑弹窗里的客户画像类型，并补齐新模板默认值。
function applyPlanEditProfileTemplate(templateCode: string) {
  planEditDraft.value.profileType = templateCode
  syncPlanEditCustomerProfileDefaults()
}

// 确保编辑弹窗当前模板的所有动态字段都有默认值。
function syncPlanEditCustomerProfileDefaults() {
  for (const field of planEditCustomerProfileFields.value) {
    if (!planEditDraft.value.customerProfileValues[field.fieldKey]) {
      planEditDraft.value.customerProfileValues[field.fieldKey] = defaultCustomerFieldValue(field)
    }
  }
}

// 组装编辑弹窗里的学员画像请求体。
function planEditTraineePayload(): TrainingTraineeProfilePayload {
  return {
    trainee_id: planEditDraft.value.traineeId.trim() || 'trainee-001',
    trainee_name: planEditDraft.value.traineeName.trim() || '销售学员',
    position_role: planEditDraft.value.positionRole,
    experience_level: planEditDraft.value.experienceLevel,
    task_goal: planEditDraft.value.taskGoal,
    weakness_tags: planEditDraft.value.weaknessTags.filter(Boolean),
    student_portrait_other: planEditDraft.value.studentPortraitOther.trim(),
  }
}

// 组装编辑弹窗里的客户画像快照，保持和新增训练方案一致的字段结构。
function planEditSelectedFieldsPayload() {
  const trainee = planEditTraineePayload()
  return {
    画像类型: planEditSelectedProfileTemplate.value?.item_name || planEditDraft.value.profileType,
    学员画像: {
      职位角色: traineeOptionLabel('position_role', trainee.position_role),
      经验等级: traineeOptionLabel('experience_level', trainee.experience_level),
      任务目标: traineeOptionLabel('task_goal', trainee.task_goal),
      短板标签: trainee.weakness_tags.map((tag) => traineeOptionLabel('weakness_tag', tag)),
      其他: trainee.student_portrait_other || '无',
    },
    ...planEditCustomerProfileDisplayPayload.value,
  }
}

async function refreshTrainingPlans() {
  loadingPlans.value = true
  try {
    const response = await listTrainingPlans(planPage.value, 6, planKeyword.value)
    trainingPlans.value = response.items
    planTotal.value = response.total
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '训练方案列表读取失败')
  } finally {
    loadingPlans.value = false
  }
}

async function openTrainingPlan(plan: TrainingPlanSummaryResponse) {
  try {
    const detail = await getTrainingPlanDetail(plan.plan_id)
    hydratePlanDetail(detail)
    activeSetupTab.value = 'role'
    planDetailVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练方案详情读取失败')
  }
}

async function deletePlanFromList(plan: TrainingPlanSummaryResponse) {
  try {
    await ElMessageBox.confirm(
      `确定删除训练方案「${plan.plan_name}」吗？删除后该方案不会再出现在训练名称列表中。`,
      '删除训练方案',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  deletingPlanId.value = plan.plan_id
  try {
    await deleteTrainingPlan(plan.plan_id)
    if (activePlan.value?.plan_id === plan.plan_id) {
      resetActiveTrainingPlanState()
    }
    if (trainingPlans.value.length === 1 && planPage.value > 1) {
      planPage.value -= 1
    }
    await refreshTrainingPlans()
    ElMessage.success('训练方案已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练方案删除失败')
  } finally {
    deletingPlanId.value = ''
  }
}

function openPlanEditDialog() {
  if (!selectedPlanDetail.value) {
    ElMessage.warning('请先选择训练方案')
    return
  }
  const detail = selectedPlanDetail.value
  const trainee = detail.trainee
  const weaknessValues = Array.isArray(trainee.weakness_tags) ? trainee.weakness_tags.map(String) : []
  planEditDraft.value = {
    planName: detail.plan.plan_name,
    traineeId: String(trainee.trainee_id || traineeId.value),
    traineeName: String(trainee.trainee_name || traineeName.value),
    positionRole: String(trainee.position_role || positionRole.value),
    experienceLevel: String(trainee.experience_level || experienceLevel.value),
    taskGoal: String(trainee.task_goal || taskGoal.value),
    weaknessTags: weaknessValues,
    studentPortraitOther: String(trainee.student_portrait_other || ''),
    profileType: detail.plan.profile_type || profileType.value,
    customerProfileValues: restoredCustomerProfileValuesForDetail(detail),
    scenarioDescription: detail.scenario_description,
    extraDetails: detail.extra_details || '',
    modelMode: detail.plan.model_mode || modelMode.value,
    roleConfirmCardJson: toPrettyJson(detail.role_confirm_card, {}),
    visibleProfileJson: toPrettyJson(detail.visible_profile, {}),
    hiddenProfileJson: toPrettyJson(detail.hidden_profile, {}),
    roleProfileJson: toPrettyJson(detail.role_profile, {}),
    trainingPurpose: detail.goal_setting?.training_purpose || '',
    roundLimit: Number(detail.goal_setting?.round_limit || 0),
    stagesJson: toPrettyJson(detail.goal_setting?.stages, []),
    scoringRulesJson: toPrettyJson(detail.goal_setting?.scoring_rules, {}),
  }
  syncPlanEditCustomerProfileDefaults()
  planEditAdvancedPanels.value = []
  planEditVisible.value = true
}

async function savePlanEdit() {
  if (!activePlan.value) {
    ElMessage.warning('请先选择训练方案')
    return
  }
  if (!planEditDraft.value.planName.trim()) {
    ElMessage.warning('请填写训练名称')
    return
  }
  if (!planEditDraft.value.scenarioDescription.trim()) {
    ElMessage.warning('请填写训练场景描述')
    return
  }
  let payload: TrainingPlanUpdatePayload
  try {
    payload = {
      plan_name: planEditDraft.value.planName.trim(),
      trainee: planEditTraineePayload(),
      profile_type: planEditDraft.value.profileType,
      selected_fields: planEditSelectedFieldsPayload(),
      scenario_description: planEditDraft.value.scenarioDescription.trim(),
      extra_details: planEditDraft.value.extraDetails.trim(),
      model_mode: planEditDraft.value.modelMode,
      role_confirm_card: parseJsonField<Record<string, unknown>>(planEditDraft.value.roleConfirmCardJson, '确认卡片'),
      visible_profile: parseJsonField<Record<string, unknown>>(planEditDraft.value.visibleProfileJson, '可见画像'),
      hidden_profile: parseJsonField<Record<string, unknown>>(planEditDraft.value.hiddenProfileJson, '隐藏画像'),
      role_profile: parseJsonField<Record<string, unknown>>(planEditDraft.value.roleProfileJson, '扮演画像'),
      training_purpose: planEditDraft.value.trainingPurpose.trim() || undefined,
      round_limit: planEditDraft.value.roundLimit ? Number(planEditDraft.value.roundLimit) : undefined,
      stages: parseJsonField(planEditDraft.value.stagesJson, '训练阶段'),
      scoring_rules: parseJsonField<Record<string, unknown>>(planEditDraft.value.scoringRulesJson, '评分规则'),
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '高级配置 JSON 格式不正确')
    return
  }
  savingPlanEdit.value = true
  try {
    const detail = await updateTrainingPlan(activePlan.value.plan_id, payload)
    hydratePlanDetail(detail)
    await refreshTrainingPlans()
    planEditVisible.value = false
    ElMessage.success('训练方案已保存，受影响的后续步骤会标记为需重新生成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练方案保存失败')
  } finally {
    savingPlanEdit.value = false
  }
}

async function polishScenarioDescription() {
  if (!draftScenarioDescription.value.trim()) {
    ElMessage.warning('请先填写场景描述')
    return
  }

  polishingScenario.value = true
  try {
    const response = await polishTrainingScenario({
      profile_type: draftProfileType.value,
      selected_fields: {
        画像类型: draftSelectedProfileTemplate.value?.item_name || draftProfileType.value,
        ...draftCustomerProfileDisplayPayload.value,
      },
      scenario_description: draftScenarioDescription.value,
      extra_details: draftExtraDetails.value,
      model_mode: draftModelMode.value,
    })
    draftScenarioDescription.value = response.polished_scenario
    ElMessage.success('场景描述已完成 AI 润色')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '场景描述润色失败')
  } finally {
    polishingScenario.value = false
  }
}

async function refreshCustomerProfileTemplates() {
  loadingProfileDictionaries.value = true
  try {
    const groups = await listTrainingProfileDictionaries()
    traineePortraitItems.value = groups.find((group) => group.dictionary_code === 'student_portrait')?.items || []
    sourceTypeItems.value = groups.find((group) => group.dictionary_code === 'training_source_type')?.items || []
    casePartItems.value = groups.find((group) => group.dictionary_code === 'training_case_part')?.items || []
    chunkUsageItems.value = groups.find((group) => group.dictionary_code === 'training_chunk_usage')?.items || []
    syncSourceTypeDefault()
    syncTraineePortraitDefaults()
    customerProfileTemplates.value = groups
      .filter((group) => CUSTOMER_PROFILE_DICTIONARY_CODES.includes(group.dictionary_code))
      .map(customerProfileTemplateFromGroup)
      .filter((item) => item.enabled)
    if (!customerProfileTemplates.value.some((item) => item.item_code === profileType.value)) {
      const defaultTemplate = customerProfileTemplates.value.find((item) => item.metadata?.default) || customerProfileTemplates.value[0]
      if (defaultTemplate) profileType.value = defaultTemplate.item_code
    }
    syncCustomerProfileDefaults()
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '客户画像字典读取失败，已使用页面默认字段')
    sourceTypeItems.value = []
    casePartItems.value = []
    chunkUsageItems.value = []
    syncSourceTypeDefault()
    customerProfileTemplates.value = fallbackCustomerProfileTemplates()
    syncCustomerProfileDefaults()
  } finally {
    loadingProfileDictionaries.value = false
  }
}

function customerProfileTemplateFromGroup(group: DictionaryGroupResponse): DictionaryItemResponse {
  const summary = CUSTOMER_PROFILE_SUMMARIES[group.dictionary_code] || '按客户画像字典动态生成字段'
  return {
    dictionary_item_id: `profile-template-${group.dictionary_code}`,
    dictionary_code: group.dictionary_code,
    dictionary_name: group.dictionary_name,
    item_code: group.dictionary_code,
    item_name: group.dictionary_name.replace(/字典$/, ''),
    parent_item_id: null,
    item_level: 1,
    sort_order: CUSTOMER_PROFILE_DICTIONARY_CODES.indexOf(group.dictionary_code) + 1,
    enabled: true,
    description: summary,
    metadata: {
      scenario_summary: summary,
      default: group.dictionary_code === DEFAULT_CUSTOMER_PROFILE_TYPE,
    },
    children: group.items,
  }
}

function fallbackCustomerProfileTemplates(): DictionaryItemResponse[] {
  return [
    fallbackTemplate('super_customer_service', '超级客服画像', '线上询盘、客户跟进、报价互动', [
      ['客户类型', 'B端客户', ['C端客户', 'B端客户', '大业务客户']],
      ['客户阶段', '报价后互动', ['产品咨询', '报价前沟通', '报价后互动', '成交推进']],
      ['客户所在地', '东南亚'],
      ['客户来源', '阿里国际站', ['Facebook', 'Google SEO', '阿里国际站', '官网询盘']],
      ['客户意向', '中等意向', ['低意向', '中等意向', '高意向']],
      ['合作阶段', '新用户', ['新用户', '老客户', '公海客户']],
      ['行业', '工程机械'],
      ['当前阶段', '再次跟进', ['首次跟进', '再次跟进', '报价解释']],
      ['核心关注点', '质量、交期、价格、物流、售后保障'],
      ['价格敏感度', '中', ['低', '中', '高']],
      ['是否决策人', '影响决策人', ['决策人', '影响决策人', '信息收集人']],
      ['适用产品', '拖拉机、高尔夫球车、焊接清洗机、报价工具'],
      ['性格特征', '谨慎犹豫', ['直接果断', '谨慎犹豫', '挑剔细节', '强势主导']],
    ]),
    fallbackTemplate('overseas_bd', '海外BD画像', '渠道开发、代理沟通、服务合作、样品推进', [
      ['客户类型', 'B端客户', ['C端客户', 'B端客户', 'G端客户']],
      ['客户分类', '中等意向', ['一般意向', '中等意向', '高意向']],
      ['合作阶段', '初次接触', ['初次接触', '需求确认', '方案介绍', '报价谈判', '样品测试']],
      ['客户所在地', '东南亚'],
      ['公司规模', '成长型企业', ['微型团队', '小型企业', '成长型企业', '大型企业']],
      ['客户来源', '谷歌搜索', ['展会', '地推', '转介绍', '谷歌搜索', '地图获客']],
      ['行业', '跨境电商'],
      ['服务内容', '服务合作', ['产品', '服务', '产品+服务', '代理合作']],
      ['核心关注点', '产品质量、交付周期、售后能力、获客成本、市场选择'],
      ['价格敏感度', '较高', ['低', '中', '较高', '极高']],
      ['是否决策人', '决策人', ['决策人', '影响决策人', '采购负责人', '信息收集人']],
      ['适用产品', '代购、代采、代卖、代发、物流、品宣、代销'],
      ['性格特征', '务实谨慎', ['直接果断', '务实谨慎', '谨慎犹豫', '挑剔细节']],
    ]),
  ]
}

function fallbackTemplate(code: string, name: string, summary: string, fields: Array<[string, string, string[]?]>): DictionaryItemResponse {
  return {
    dictionary_item_id: `fallback-${code}`,
    dictionary_code: 'sales_customer_profile_template',
    dictionary_name: '销售陪练客户画像模板',
    item_code: code,
    item_name: name,
    item_level: 1,
    sort_order: 1,
    enabled: true,
    description: summary,
    metadata: { scenario_summary: summary, default: code === 'overseas_bd' },
    children: fields.map((field, index) => ({
      dictionary_item_id: `fallback-${code}-${index}`,
      dictionary_code: 'sales_customer_profile_template',
      dictionary_name: '销售陪练客户画像模板',
      item_code: `${code}-${index}`,
      item_name: field[0],
      parent_item_id: `fallback-${code}`,
      item_level: 2,
      sort_order: index + 1,
      enabled: true,
      description: '',
      metadata: {
        field_key: field[0],
        input_type: field[2] ? 'select' : 'textarea',
        default_value: field[1],
        options: field[2] || [],
      },
      children: [],
    })),
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

function onFileChange(file: File | undefined) {
  selectedFile.value = file || null
  uploadResult.value = null
}

function clearUploadArea() {
  selectedFile.value = null
  uploadResult.value = null
}

function buildRoleGeneratePayload(extraDetailText = extraDetails.value) {
  return {
    plan_id: activePlan.value?.plan_id || null,
    trainee: {
      trainee_id: traineeId.value,
      trainee_name: traineeName.value,
      position_role: positionRole.value,
      experience_level: experienceLevel.value,
      task_goal: taskGoal.value,
      weakness_tags: weaknessTags.value,
      student_portrait_other: studentPortraitOther.value,
    },
    profile_type: profileType.value,
    selected_fields: {
      画像类型: selectedProfileTemplate.value?.item_name || profileType.value,
      学员画像: {
        职位角色: positionRoleLabel.value,
        经验等级: experienceLevelLabel.value,
        任务目标: taskGoalLabel.value,
        短板标签: weaknessTagLabels.value,
        其他: studentPortraitOther.value || '无',
      },
      ...customerProfileDisplayPayload.value,
    },
    scenario_description: scenarioDescription.value,
    extra_details: extraDetailText,
    model_mode: modelMode.value,
  }
}

function resetSupplementAnswers(questions: TrainingSupplementQuestion[]) {
  supplementAnswers.value = Object.fromEntries(
    questions.map((question) => [question.question_id, question.options[0]?.option_code || '']),
  )
  supplementOtherAnswers.value = {}
}

function selectedSupplementOption(question: TrainingSupplementQuestion): TrainingSupplementQuestionOption | null {
  const selectedCode = supplementAnswers.value[question.question_id]
  return question.options.find((option) => option.option_code === selectedCode) || null
}

function buildSupplementDetailText() {
  const answers = supplementQuestions.value.map((question) => {
    const selected = selectedSupplementOption(question)
    const otherText = supplementOtherAnswers.value[question.question_id]?.trim()
    const answer = selected ? `${selected.option_code}. ${selected.option_text}` : ''
    return [
      `${question.question_no}. ${question.question}`,
      answer && `选择：${answer}`,
      otherText && `补充：${otherText}`,
    ].filter(Boolean).join('\n')
  })
  return [
    extraDetails.value.trim(),
    answers.length ? '补充问答场景细节：' : '',
    ...answers,
  ].filter(Boolean).join('\n\n')
}

function goPreviousSetupStep() {
  if (activeSetupTab.value === 'score') {
    activeSetupTab.value = 'stage'
    return
  }
  if (activeSetupTab.value === 'stage') {
    activeSetupTab.value = 'role'
    return
  }
  if (activeSetupTab.value === 'role') {
    activeSetupTab.value = 'plan'
  }
}

function goNextSetupStep() {
  if (activeSetupTab.value === 'plan') {
    if (!activePlan.value) {
      ElMessage.warning('请先创建或选择训练名称')
      return
    }
    activeSetupTab.value = 'role'
    return
  }
  if (activeSetupTab.value === 'role') {
    if (!roleResult.value) {
      ElMessage.warning('请先生成 AI 客户角色')
      return
    }
    activeSetupTab.value = 'stage'
    return
  }
  if (activeSetupTab.value === 'stage') {
    if (!goalSetting.value) {
      ElMessage.warning('请先生成训练阶段')
      return
    }
    activeSetupTab.value = 'score'
  }
}

function openTrainingAction(action: TrainingNextAction) {
  activeWorkspaceTab.value = action.tab
  if (action.setupTab) {
    openSetupTab(action.setupTab)
  }
}

// 统一控制创建训练向导的跳转，避免越过训练名称、角色、阶段等前置步骤。
function openSetupTab(tab: SetupFlowTab) {
  if (tab === 'role' && !activePlan.value) {
    ElMessage.warning('请先创建或选择训练名称')
    activeSetupTab.value = 'plan'
    return
  }
  if (tab === 'stage' && !roleResult.value) {
    ElMessage.warning(activePlan.value ? '请先生成 AI 客户角色' : '请先创建或选择训练名称')
    activeSetupTab.value = activePlan.value ? 'role' : 'plan'
    return
  }
  if (tab === 'score' && !goalSetting.value) {
    ElMessage.warning(roleResult.value ? '请先生成训练阶段' : activePlan.value ? '请先生成 AI 客户角色' : '请先创建或选择训练名称')
    activeSetupTab.value = roleResult.value ? 'stage' : activePlan.value ? 'role' : 'plan'
    return
  }
  activeSetupTab.value = tab
}

function addSystemMessage(content: string) {
  messages.value.push({
    id: `system-${Date.now()}-${Math.random()}`,
    role: 'system',
    content,
  })
}

async function scrollToBottom() {
  await nextTick()
  if (trainingWindow.value) {
    trainingWindow.value.scrollTop = trainingWindow.value.scrollHeight
  }
}

async function uploadKnowledge() {
  // 第一步：前端先校验是否已经选择文件，避免空文件请求打到后端。
  if (!selectedFile.value) {
    ElMessage.warning('请先选择 LMS 案例文件')
    return
  }

  uploading.value = true
  try {
    // 第二步：把 File 对象封装成 FormData，调用后端 /training/knowledge/upload。
    // 后端会完成文件保存、MD5 去重、解析切片和质量评估；确认发布前只写入临时向量库。
    uploadResult.value = await uploadTrainingKnowledge({
      file: selectedFile.value,
      sourceType: sourceType.value,
      modelMode: modelMode.value,
    })
    // 第三步：上传成功后立即拉取本批次切片，让右侧切片概览能马上展示。
    const response = await listTrainingKnowledgeChunks(uploadResult.value.batch_id)
    chunks.value = response.chunks
    activeBatchId.value = uploadResult.value.batch_id
    // 第四步：异步刷新上传批次列表，不阻塞当前成功提示。
    void refreshTrainingBatches()
    ElMessage.success(uploadResult.value.duplicate_of ? '资料已存在，已复用历史入库批次' : '训练资料预览已生成，请确认后发布')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练知识上传失败')
  } finally {
    uploading.value = false
  }
}

async function publishTrainingBatch(batchId: string) {
  // 人工确认发布后，后端会把临时向量库里的切片复制到正式训练向量库。
  publishingBatchId.value = batchId
  try {
    const result = await publishTrainingKnowledgeBatch(batchId)
    if (uploadResult.value?.batch_id === batchId) {
      uploadResult.value = {
        ...uploadResult.value,
        status: result.status,
        chunk_count: result.chunk_count,
        point_count: result.point_count,
        quality_report: result.quality_report,
      }
    }
    await refreshTrainingBatches()
    const response = await listTrainingKnowledgeChunks(batchId)
    chunks.value = response.chunks
    activeBatchId.value = batchId
    if (versionDialogVisible.value) {
      await loadBatchVersions(batchId)
    }
    ElMessage.success('训练资料已发布并写入向量库')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料发布失败')
  } finally {
    publishingBatchId.value = ''
  }
}

async function rollbackTrainingBatch(batch: TrainingKnowledgeBatchResponse) {
  // 回滚会把该历史版本标记为当前版本，并让同版本组其他版本退出训练检索。
  try {
    await ElMessageBox.confirm(
      `确定回滚到「${batch.source_file}」的 V${batch.version_no || 1} 吗？当前版本会变成历史版本。`,
      '回滚训练资料版本',
      {
        confirmButtonText: '确认回滚',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  rollingBackBatchId.value = batch.batch_id
  try {
    const result = await rollbackTrainingKnowledgeBatch(batch.batch_id)
    if (uploadResult.value?.batch_id === batch.batch_id) {
      uploadResult.value = {
        ...uploadResult.value,
        status: result.status,
        chunk_count: result.chunk_count,
        point_count: result.point_count,
        quality_report: result.quality_report,
      }
    }
    await refreshTrainingBatches()
    const response = await listTrainingKnowledgeChunks(batch.batch_id)
    chunks.value = response.chunks
    activeBatchId.value = batch.batch_id
    if (versionDialogVisible.value) {
      await loadBatchVersions(batch.batch_id)
    }
    ElMessage.success(`已回滚到 V${result.version_no}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料回滚失败')
  } finally {
    rollingBackBatchId.value = ''
  }
}

async function reparseTrainingBatch(batch: TrainingKnowledgeBatchResponse | string) {
  // 人工重切只允许用于未发布批次，后端会重新生成临时向量库切片，等待再次发布。
  const batchId = typeof batch === 'string' ? batch : batch.batch_id
  const sourceFile = typeof batch === 'string' ? uploadResult.value?.source_file || '当前资料' : batch.source_file
  try {
    await ElMessageBox.confirm(
      `确定使用 LLM 重新切分「${sourceFile}」吗？重切后需要再次人工确认发布。`,
      'LLM 重新切分',
      {
        confirmButtonText: '确认重切',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  reparsingBatchId.value = batchId
  try {
    const result = await reparseTrainingKnowledgeBatch(batchId, true, modelMode.value)
    if (uploadResult.value?.batch_id === batchId) {
      uploadResult.value = {
        ...uploadResult.value,
        status: result.status,
        chunk_count: result.chunk_count,
        point_count: result.point_count,
        source_file: result.source_file ?? uploadResult.value.source_file,
        quality_report: result.quality_report,
      }
    }
    await refreshTrainingBatches()
    const response = await listTrainingKnowledgeChunks(batchId)
    chunks.value = response.chunks
    activeBatchId.value = batchId
    if (versionDialogVisible.value) {
      await loadBatchVersions(batchId)
    }
    ElMessage.success('LLM 重新切分完成，请检查切片后再发布')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料重新切分失败')
  } finally {
    reparsingBatchId.value = ''
  }
}

async function loadBatchVersions(batchId: string) {
  // 版本链用于展示同一份资料的全部历史版本，后续回滚和查看切片都从这里进入。
  versionLoading.value = true
  try {
    const response = await listTrainingKnowledgeBatchVersions(batchId)
    activeVersionGroupId.value = response.version_group_id
    batchVersions.value = response.items
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料版本链读取失败')
  } finally {
    versionLoading.value = false
  }
}

async function openBatchVersions(batch: TrainingKnowledgeBatchResponse) {
  // 打开版本弹窗时立即拉取最新版本链，避免列表里的状态滞后。
  versionDialogVisible.value = true
  await loadBatchVersions(batch.batch_id)
}

async function refreshTrainingBatches() {
  loadingBatches.value = true
  try {
    // 资料管理左侧列表只展示未删除批次，后端按更新时间倒序分页。
    const response = await listTrainingKnowledgeBatches(batchPage.value, 6)
    // 删除最后一页最后一条数据后，当前页可能为空；这里自动回退一页。
    if (response.items.length === 0 && response.total > 0 && batchPage.value > 1) {
      batchPage.value -= 1
      await refreshTrainingBatches()
      return
    }
    trainingBatches.value = response.items
    batchTotal.value = response.total
    if (!activeBatchId.value && response.items.length) {
      await openTrainingBatch(response.items[0])
    }
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '训练资料列表读取失败')
  } finally {
    loadingBatches.value = false
  }
}

async function openTrainingBatch(batch: TrainingKnowledgeBatchResponse) {
  // 点击某个批次时，只切换当前批次和切片列表，不会重新解析文件。
  activeBatchId.value = batch.batch_id
  loadingChunks.value = true
  try {
    const response = await listTrainingKnowledgeChunks(batch.batch_id)
    chunks.value = response.chunks
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料切片读取失败')
  } finally {
    loadingChunks.value = false
  }
}

async function previewTrainingBatch(batch: TrainingKnowledgeBatchResponse) {
  // 预览读取的是服务端保存的原文件，再由后端解析成文本；不会重新写向量库。
  previewingBatchId.value = batch.batch_id
  try {
    trainingPreview.value = await previewTrainingKnowledgeBatch(batch.batch_id)
    trainingPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料预览失败')
  } finally {
    previewingBatchId.value = ''
  }
}

async function deleteTrainingBatch(batch: TrainingKnowledgeBatchResponse) {
  // 删除前先二次确认，因为后端会同步删除该批次在 Qdrant 中的向量点。
  try {
    await ElMessageBox.confirm(
      `确定删除训练资料「${batch.source_file}」吗？删除后会移除对应向量点。`,
      '删除训练资料',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  deletingBatchId.value = batch.batch_id
  try {
    // 后端走统一文件资产删除链路：硬删除 MySQL 批次/documents 记录，并清理 Qdrant 与 MinIO。
    await deleteTrainingKnowledgeBatch(batch.batch_id)
    ElMessage.success('训练资料已删除')
    if (activeBatchId.value === batch.batch_id) {
      activeBatchId.value = ''
      chunks.value = []
    }
    await refreshTrainingBatches()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练资料删除失败')
  } finally {
    deletingBatchId.value = ''
  }
}

async function prepareRoleGeneration() {
  if (!activePlan.value) {
    ElMessage.warning('请先输入训练名称并创建训练方案')
    return
  }
  if (!scenarioDescription.value.trim()) {
    ElMessage.warning('请填写训练场景描述')
    return
  }

  generatingSupplementQuestions.value = true
  try {
    const response = await generateTrainingSupplementQuestions(buildRoleGeneratePayload())
    supplementQuestions.value = response.questions || []
    resetSupplementAnswers(supplementQuestions.value)
    supplementDialogVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '补充问答生成失败')
  } finally {
    generatingSupplementQuestions.value = false
  }
}

async function confirmSupplementAndGenerateRole() {
  if (supplementQuestions.value.some((question) => !supplementAnswers.value[question.question_id])) {
    ElMessage.warning('请先完成所有补充问题')
    return
  }
  supplementDialogVisible.value = false
  await generateRole(buildSupplementDetailText())
}

async function generateRole(extraDetailText = extraDetails.value) {
  generatingRole.value = true
  try {
    roleResult.value = await generateTrainingRole(buildRoleGeneratePayload(extraDetailText))
    activeSetupTab.value = 'role'
    goalSetting.value = null
    activeSession.value = null
    scoreResult.value = null
    messages.value = []
    isReviewMode.value = false
    if (activePlan.value) {
      const detail = await getTrainingPlanDetail(activePlan.value.plan_id)
      hydratePlanDetail(detail)
      activeSetupTab.value = 'role'
      await refreshTrainingPlans()
    }
    ElMessage.success('AI 客户角色已生成，请人工审核后点击下一步')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'AI 客户角色生成失败')
  } finally {
    generatingRole.value = false
  }
}

async function generateGoal() {
  if (!roleResult.value) {
    ElMessage.warning('请先生成 AI 客户角色')
    return
  }

  generatingGoal.value = true
  try {
    goalSetting.value = await generateTrainingGoalSetting(roleResult.value.profile_id, traineeId.value, modelMode.value, activePlan.value?.plan_id)
    if (activePlan.value) {
      const detail = await getTrainingPlanDetail(activePlan.value.plan_id)
      hydratePlanDetail(detail)
      activeSetupTab.value = 'stage'
      await refreshTrainingPlans()
    }
    activeSession.value = null
    scoreResult.value = null
    messages.value = []
    isReviewMode.value = false
    ElMessage.success('训练阶段已生成，请人工审核后点击下一步')
    activeWorkspaceTab.value = 'setup'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练目标生成失败')
  } finally {
    generatingGoal.value = false
  }
}

async function startSession() {
  if (!roleResult.value || !goalSetting.value) {
    ElMessage.warning('请先生成角色和训练目标')
    return
  }

  startingSession.value = true
  try {
    activeSession.value = await startTrainingSession({
      profile_id: roleResult.value.profile_id,
      setting_id: goalSetting.value.setting_id,
      trainee_id: traineeId.value,
      response_mode: responseMode.value,
      model_mode: modelMode.value,
    })
    scoreResult.value = null
    messages.value = []
    isReviewMode.value = false
    retrievedChunkIds.value = []
    stageStatus.value = '训练中'
    isReviewMode.value = false
    if (activeSession.value.opening_message) {
      messages.value.push({
        id: `customer-opening-${activeSession.value.session_id}`,
        role: 'customer',
        content: activeSession.value.opening_message,
        meta: '开场白',
      })
    } else {
      addSystemMessage('训练已开始。你现在面对的是 AI 客户，请用销售沟通方式推进目标。')
    }
    await scrollToBottom()
    void refreshTrainingHistory()
    ElMessage.success('训练会话已开始')
    activeWorkspaceTab.value = 'chat'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练会话启动失败')
  } finally {
    startingSession.value = false
  }
}

async function submitTurn() {
  if (!activeSession.value) {
    ElMessage.warning('请先开始训练')
    return
  }
  const message = traineeMessage.value.trim()
  if (!message) {
    ElMessage.warning('请输入学员回复')
    return
  }

  messages.value.push({
    id: `trainee-${Date.now()}`,
    role: 'trainee',
    content: message,
    meta: `第 ${answeredRounds.value + 1} 轮`,
  })
  traineeMessage.value = ''
  scoreResult.value = null
  submittingTurn.value = true
  await scrollToBottom()

  try {
    if (responseMode.value === 'stream') {
      await submitTurnByStream(message)
    } else {
      await submitTurnByBlocking(message)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练回复生成失败')
  } finally {
    submittingTurn.value = false
    await scrollToBottom()
  }
}

async function submitTurnByBlocking(message: string) {
  if (!activeSession.value) return
  const response = await submitTrainingTurn(activeSession.value.session_id, {
    message,
    response_mode: 'blocking',
    model_mode: modelMode.value,
  })
  applyTurnDone(response)
  messages.value.push({
    id: `customer-${Date.now()}`,
    role: 'customer',
    content: response.customer_reply,
    meta: response.response_seconds ? `${response.response_seconds}s` : '一次性',
    analysis: response.coach_analysis,
  })
}

async function submitTurnByStream(message: string) {
  if (!activeSession.value) return
  const customerMessage: TrainingMessage = {
    id: `customer-${Date.now()}`,
    role: 'customer',
    content: '',
    meta: '流式生成中',
    streaming: true,
  }
  messages.value.push(customerMessage)

  try {
    await submitTrainingTurnStream(
      activeSession.value.session_id,
      {
        message,
        response_mode: 'stream',
        model_mode: modelMode.value,
      },
      {
        onRetrieval: async (payload) => {
          retrievedChunkIds.value = safeList(payload.retrieved_chunk_ids)
        },
        onDelta: async (content) => {
          customerMessage.content += content
          await scrollToBottom()
        },
        onStageDecision: async (payload) => {
          stageStatus.value = String(payload.stage_status || '训练中')
        },
        onDone: async (payload) => {
          customerMessage.streaming = false
          customerMessage.meta = payload.response_seconds ? `${payload.response_seconds}s` : '流式完成'
          if (!customerMessage.content.trim()) {
            customerMessage.content = payload.customer_reply
          }
          customerMessage.analysis = payload.coach_analysis
          applyTurnDone(payload)
        },
      },
    )
  } catch (error) {
    customerMessage.streaming = false
    customerMessage.meta = '生成失败'
    customerMessage.content = customerMessage.content || '本轮 AI 客户回复生成失败，请稍后重试。'
    throw error
  }
}

function applyTurnDone(response: TrainingTurnResponse) {
  retrievedChunkIds.value = response.retrieved_chunk_ids || []
  stageStatus.value = response.stage_status
  if (activeSession.value) {
    activeSession.value.status = response.session_status as TrainingSessionResponse['status']
    activeSession.value.current_stage_no = response.current_stage_no
  }
}

async function finishAndScore() {
  if (!activeSession.value) {
    ElMessage.warning('请先开始训练')
    return
  }

  scoring.value = true
  try {
    scoreResult.value = await generateTrainingFinalScore(activeSession.value.session_id, modelMode.value)
    activeSession.value.status = 'completed' as TrainingSessionResponse['status']
    addSystemMessage(`训练评分完成：${scoreResult.value.total_score} 分，等级 ${scoreResult.value.level}。`)
    void refreshTrainingHistory()
    await scrollToBottom()
    ElMessage.success('训练评分报告已生成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练评分失败')
  } finally {
    scoring.value = false
  }
}

async function refreshTrainingHistory() {
  loadingHistory.value = true
  try {
    const response = await listTrainingSessions(historyPage.value, 6, traineeId.value)
    trainingHistories.value = response.items
    historyTotal.value = response.total
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '训练历史读取失败')
  } finally {
    loadingHistory.value = false
  }
}

async function openTrainingHistory(item: TrainingSessionSummaryResponse) {
  loadingDetail.value = true
  try {
    const detail = await getTrainingSessionDetail(item.session_id)
    hydrateTrainingDetail(detail)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '训练复盘读取失败')
  } finally {
    loadingDetail.value = false
  }
}

function hydrateTrainingDetail(detail: TrainingSessionDetailResponse) {
  isReviewMode.value = true
  activeSession.value = {
    session_id: detail.session.session_id,
    profile_id: '',
    setting_id: '',
    trainee_id: detail.session.trainee_id,
    training_mode: detail.session.training_mode,
    response_mode: detail.session.response_mode,
    current_stage_no: 1,
    status: detail.session.status,
    round_limit: detail.session.round_limit,
    opening_message: null,
  }
  responseMode.value = detail.session.response_mode
  activeSetupTab.value = 'score'
  scoreResult.value = detail.score || null
  stageStatus.value = detail.session.status
  const goalRoundLimit = Number(detail.goal_setting.round_limit || detail.session.round_limit)
  goalSetting.value = {
    setting_id: String(detail.goal_setting.setting_id || ''),
    profile_id: '',
    training_mode: detail.session.training_mode,
    training_purpose: String(detail.goal_setting.training_purpose || '历史训练'),
    round_limit: goalRoundLimit,
    stages: Array.isArray(detail.goal_setting.stages) ? detail.goal_setting.stages : [],
    scoring_rules: typeof detail.goal_setting.scoring_rules === 'object' && detail.goal_setting.scoring_rules
      ? detail.goal_setting.scoring_rules as Record<string, unknown>
      : {},
    status: detail.session.status,
  }
  roleResult.value = {
    profile_id: '',
    visible_profile: detail.visible_profile || detail.role_profile,
    hidden_profile: detail.hidden_profile || {},
    role_profile: detail.role_profile,
    role_confirm_card: detail.role_confirm_card || detail.role_profile,
    hidden_summary: '历史训练已隐藏 AI 客户底层顾虑。',
    retrieved_cases: [],
    knowledge_facts: detail.knowledge_facts || [],
  }
  messages.value = detail.turns.map((turn) => ({
    id: turn.turn_id,
    role: turn.role === 'trainee' ? 'trainee' : turn.role === 'customer' ? 'customer' : 'system',
    content: turn.content,
    meta: turn.round_no === 0 ? '开场白' : `第 ${turn.round_no} 轮`,
    analysis: turn.coach_analysis,
  }))
  const lastCustomerTurn = [...detail.turns].reverse().find((turn) => turn.retrieved_chunk_ids.length > 0)
  retrievedChunkIds.value = lastCustomerTurn?.retrieved_chunk_ids || []
}

watch(profileType, () => {
  syncCustomerProfileDefaults()
})

watch(draftProfileType, () => {
  syncDraftCustomerProfileDefaults()
})

onMounted(() => {
  void refreshTrainingHistory()
  void refreshTrainingBatches()
  void refreshCustomerProfileTemplates()
  void refreshTrainingPlans()
})
</script>

<template>
  <div class="sales-training-page">
    <header class="page-hero sales-training-hero">
      <div>
        <span class="page-kicker"><BrainCircuit :size="16" /> AI 销售陪练</span>
        <h2>客户画像驱动的开放式训练</h2>
        <p>把 LMS 案例写入训练向量库，由模型生成 AI 客户、训练目标和动态轮数，再通过文字对话锻炼销售沟通能力。</p>
      </div>
      <div class="training-hero-actions">
        <button
          type="button"
          class="hero-chip hero-chip-button"
          :class="{ active: activeWorkspaceTab === 'knowledge' }"
          @click="activeWorkspaceTab = 'knowledge'"
        >
          <UploadCloud :size="15" />
          资料管理
          <em>{{ batchTotal > 0 ? `${batchTotal} 批` : '待上传' }}</em>
        </button>
        <span class="hero-chip"><Network :size="15" /> 向量库 sales_training_cases</span>
        <span class="hero-chip"><Route :size="15" /> 向导式创建</span>
        <span class="hero-chip"><ShieldCheck :size="15" /> 文字训练</span>
      </div>
    </header>

    <section class="training-console-layout">
      <aside class="training-workspace-rail">
        <section class="training-next-card compact">
          <div class="next-card-header">
            <span><Sparkles :size="16" /> 下一步</span>
            <em>{{ trainingReadinessPercent }}%</em>
          </div>
          <strong>{{ nextTrainingAction.title }}</strong>
          <p>{{ nextTrainingAction.detail }}</p>
          <div class="readiness-bar" aria-label="训练准备度">
            <i :style="{ width: `${trainingReadinessPercent}%` }" />
          </div>
          <button type="button" class="next-action-button" @click="openTrainingAction(nextTrainingAction)">
            {{ nextTrainingAction.actionText }}
            <ArrowRight :size="15" />
          </button>
        </section>

        <nav class="training-workspace-nav" aria-label="销售训练工作区">
          <button
            v-for="item in trainingWorkspaceNavItems"
            :key="item.key"
            type="button"
            :class="{ active: activeWorkspaceTab === item.key, ready: item.ready }"
            @click="activeWorkspaceTab = item.key"
          >
            <span class="workspace-nav-icon"><component :is="item.icon" :size="18" /></span>
            <span>
              <strong>{{ item.title }}</strong>
              <em>{{ item.desc }}</em>
            </span>
            <b>{{ item.value }}</b>
            <small>{{ item.status }}</small>
          </button>
        </nav>
      </aside>

      <main class="training-workspace-stage">
    <TrainingKnowledgeWorkspace
      v-show="activeWorkspaceTab === 'knowledge'"
      v-model:batch-page="batchPage"
      v-model:chunk-detail-visible="chunkDetailVisible"
      v-model:version-dialog-visible="versionDialogVisible"
      v-model:training-preview-visible="trainingPreviewVisible"
      :selected-file="selectedFile"
      :upload-result="uploadResult"
      :training-batches="trainingBatches"
      :batch-total="batchTotal"
      :active-batch-id="activeBatchId"
      :chunk-type-summaries="chunkTypeSummaries"
      :active-chunk-type-chunks="activeChunkTypeChunks"
      :active-chunk-summary="activeChunkSummary"
      :batch-versions="batchVersions"
      :active-version-group-id="activeVersionGroupId"
      :training-preview="trainingPreview"
      :loading-batches="loadingBatches"
      :loading-chunks="loadingChunks"
      :uploading="uploading"
      :publishing-batch-id="publishingBatchId"
      :rolling-back-batch-id="rollingBackBatchId"
      :reparsing-batch-id="reparsingBatchId"
      :previewing-batch-id="previewingBatchId"
      :deleting-batch-id="deletingBatchId"
      :version-loading="versionLoading"
      :upload-help-description="uploadHelpDescription"
      :current-upload-chunk-count="currentUploadChunkCount"
      :current-upload-point-count="currentUploadPointCount"
      :current-upload-status="currentUploadStatus"
      :current-upload-duplicate-text="currentUploadDuplicateText"
      :can-clear-upload-area="canClearUploadArea"
      :upload-quality-report="uploadQualityReport"
      :upload-quality-warnings="uploadQualityWarnings"
      :upload-quality-metrics="uploadQualityMetrics"
      :upload-quality-split-text="uploadQualitySplitText"
      :upload-publish-validation="uploadPublishValidation"
      :format-time="formatTime"
      :batch-status-label="batchStatusLabel"
      :quality-level-label="qualityLevelLabel"
      :quality-level-class="qualityLevelClass"
      :chunk-summary-title="chunkSummaryTitle"
      :chunk-usage-label="chunkUsageLabel"
      :case-part-label="casePartLabel"
      :chunk-detail-meta="chunkDetailMeta"
      @file-change="onFileChange"
      @clear-upload="clearUploadArea"
      @upload="uploadKnowledge"
      @refresh-batches="refreshTrainingBatches"
      @publish-batch="publishTrainingBatch"
      @reparse-batch="reparseTrainingBatch"
      @rollback-batch="rollbackTrainingBatch"
      @open-batch-versions="openBatchVersions"
      @open-training-batch="openTrainingBatch"
      @preview-batch="previewTrainingBatch"
      @delete-batch="deleteTrainingBatch"
      @open-chunk-summary="openChunkSummaryDetail"
    />

    <section
      v-show="activeWorkspaceTab === 'setup'"
      class="training-workspace"
      :class="{ 'plan-step-workspace': activeSetupTab === 'plan', 'has-left-panel': Boolean(activePlan) }"
    >
      <aside v-if="activePlan" class="training-left-panel">
        <section v-if="activePlan" class="training-panel active-plan-brief">
          <div class="panel-title panel-title-between">
            <span><Route :size="16" /> 当前训练</span>
            <em>已选择</em>
          </div>
          <div class="active-plan-card">
            <strong>{{ activePlan.plan_name }}</strong>
            <span>角色：{{ activePlan.role_status }} · 阶段：{{ activePlan.goal_status }} · 评分：{{ activePlan.score_status }}</span>
            <div>
              <el-button text @click="planDetailVisible = true">查看详情</el-button>
              <el-button text @click="openSetupTab('plan')">切换</el-button>
            </div>
          </div>
        </section>

        <section v-if="activePlan && activeSetupTab !== 'plan'" class="training-panel profile-summary-panel">
          <div class="panel-title panel-title-between">
            <span><UserRoundCheck :size="16" /> 学员画像</span>
            <em>{{ traineeName }}</em>
          </div>
          <div class="profile-chip-cloud">
            <span v-for="tag in traineeProfileTags" :key="`trainee-${tag}`" :title="tag">{{ compactText(tag) }}</span>
            <span v-if="traineeProfileTags.length === 0">未配置</span>
          </div>
          <el-button class="tech-button primary" @click="openTraineeProfileDialog">
            修改学员画像
          </el-button>
        </section>
      </aside>

      <section class="training-main-panel">
        <section class="setup-flow-tabs" aria-label="创建训练步骤">
          <button
            type="button"
            class="setup-step-card"
            :class="{ active: activeSetupTab === 'plan', done: activePlan }"
            @click="openSetupTab('plan')"
          >
            <Route :size="16" />
            <span>
              <strong>训练名称</strong>
              <em>{{ planFlowStatusText }}</em>
            </span>
          </button>
          <button
            type="button"
            class="setup-step-card"
            :class="{ active: activeSetupTab === 'role', done: roleResult, locked: !canOpenRoleSetup }"
            @click="openSetupTab('role')"
          >
            <Sparkles :size="16" />
            <span>
              <strong>角色场景</strong>
              <em>{{ roleFlowStatusText }}</em>
            </span>
          </button>
          <button
            type="button"
            class="setup-step-card"
            :class="{ active: activeSetupTab === 'stage', done: goalSetting, locked: !canOpenStageSetup }"
            @click="openSetupTab('stage')"
          >
            <Gauge :size="16" />
            <span>
              <strong>训练阶段</strong>
              <em>{{ stageFlowStatusText }}</em>
            </span>
          </button>
          <button
            type="button"
            class="setup-step-card"
            :class="{ active: activeSetupTab === 'score', done: goalSetting, locked: !canOpenScoreSetup }"
            @click="openSetupTab('score')"
          >
            <Trophy :size="16" />
            <span>
              <strong>评分设置</strong>
              <em>{{ scoreFlowStatusText }}</em>
            </span>
          </button>
        </section>

        <section class="setup-flow-content">
          <article v-show="activeSetupTab === 'plan'" class="training-panel training-plan-panel">
            <div class="panel-title panel-title-between">
              <span><Route :size="16" /> 训练名称</span>
              <em>{{ activePlan ? '已选择' : '第一步' }}</em>
            </div>
            <div class="plan-step-layout">
              <section class="plan-step-create">
                <strong>新建一场训练</strong>
                <span>训练名称可以重复，系统会用不同的训练编号区分历史记录。</span>
                <div class="training-plan-create">
                  <el-input v-model="planName" placeholder="输入训练名称，例如：海外 BD 异议处理" clearable />
                  <el-button class="tech-button primary" :loading="creatingPlan" @click="createPlanFromCurrentInput">
                    创建训练
                  </el-button>
                </div>
                <p>创建后再进入学员画像、客户画像、场景描述和模型档位设置。</p>
              </section>
              <section class="plan-step-list">
                <div class="training-plan-filter">
                  <el-input v-model="planKeyword" placeholder="搜索训练名称" clearable @keyup.enter="refreshTrainingPlans" />
                  <el-button class="tech-button compact" :loading="loadingPlans" @click="refreshTrainingPlans">刷新</el-button>
                </div>
                <div class="training-plan-list" v-loading="loadingPlans">
                  <article
                    v-for="plan in trainingPlans"
                    :key="plan.plan_id"
                    class="training-plan-list-item"
                    :class="{ active: activePlan?.plan_id === plan.plan_id }"
                  >
                    <button type="button" class="training-plan-open" @click="openTrainingPlan(plan)">
                      <strong>{{ plan.plan_name }}</strong>
                      <span>{{ formatTime(plan.updated_at) }} · {{ plan.role_status }}/{{ plan.goal_status }}/{{ plan.score_status }}</span>
                    </button>
                    <el-tooltip content="删除训练方案" placement="top">
                      <el-button
                        class="training-plan-delete"
                        :icon="Trash2"
                        circle
                        :loading="deletingPlanId === plan.plan_id"
                        @click.stop="deletePlanFromList(plan)"
                      />
                    </el-tooltip>
                  </article>
                  <span v-if="trainingPlans.length === 0">暂无训练方案</span>
                </div>
                <el-pagination
                  v-if="planTotal > 6"
                  v-model:current-page="planPage"
                  size="small"
                  layout="prev, pager, next"
                  :page-size="6"
                  :total="planTotal"
                  @current-change="refreshTrainingPlans"
                />
              </section>
            </div>
            <div v-if="activePlan" class="setup-flow-actions">
              <el-button class="tech-button ghost" :icon="ArrowLeft" disabled>
                上一步
              </el-button>
              <div>
                <strong>训练名称已确定</strong>
                <span>下一步配置学员画像、客户画像、场景描述，再生成 AI 客户。</span>
              </div>
              <el-button class="tech-button primary" :icon="ArrowRight" @click="goNextSetupStep">
                下一步
              </el-button>
            </div>
          </article>
          <article v-show="activeSetupTab === 'role'" class="training-panel role-card">
            <div class="panel-title panel-title-between">
              <span><Radar :size="16" /> 角色场景</span>
              <em>{{ roleResult?.profile_id ? '已确认' : '待生成' }}</em>
            </div>
            <template v-if="roleResult">
              <section class="role-confirm-view">
                <header>
                  <div>
                    <strong>{{ roleTitleText }}</strong>
                    <span>{{ roleConfirmMetaText }}</span>
                  </div>
                  <el-button text @click="prepareRoleGeneration">编辑</el-button>
                </header>
                <article class="role-confirm-card blue">
                  <b>角色简介</b>
                  <p>{{ roleSummaryText }}</p>
                </article>
                <article class="role-confirm-card amber">
                  <b>性格特征</b>
                  <p>{{ rolePersonalityText }}</p>
                </article>
                <section class="role-confirm-section">
                  <b>成本控制习惯</b>
                  <p v-for="item in roleCostHabitList" :key="`cost-${item}`">{{ item }}</p>
                  <p v-if="roleCostHabitList.length === 0">日常运营严格审核支出，优先选择高性价比方案。</p>
                </section>
                <section class="role-confirm-section">
                  <b>业务痛点</b>
                  <p v-for="item in roleBusinessPainList" :key="`pain-${item}`">{{ item }}</p>
                  <p v-if="roleBusinessPainList.length === 0">当前业务痛点需要在训练对话中进一步挖掘确认。</p>
                </section>
                <section class="role-confirm-section">
                  <b>潜台词</b>
                  <p v-for="item in roleSubtextList" :key="`subtext-${item}`">{{ item }}</p>
                  <p v-if="roleSubtextList.length === 0">客户真实顾虑不会主动说出，需要学员通过提问逐步挖掘。</p>
                </section>
              </section>
            </template>
            <div v-else class="training-empty">
              <BrainCircuit :size="28" />
              <span>填写画像和场景后生成 AI 客户。</span>
            </div>
            <div class="setup-flow-actions">
              <el-button class="tech-button ghost" :icon="ArrowLeft" :disabled="!canGoPreviousSetupStep" @click="goPreviousSetupStep">
                上一步
              </el-button>
              <div>
                <strong>{{ roleResult ? '确认角色后进入训练阶段' : '先完成角色生成' }}</strong>
                <span>{{ roleResult ? '确认这位 AI 客户符合本次训练场景，再生成训练阶段。' : '根据学员画像、客户画像、场景描述和训练知识，生成本次要面对的 AI 客户。' }}</span>
              </div>
              <el-button class="tech-button primary" :icon="Sparkles" :loading="generatingSupplementQuestions || generatingRole" @click="prepareRoleGeneration">
                {{ roleResult ? '重新生成 AI 客户' : '生成 AI 客户' }}
              </el-button>
              <el-button class="tech-button" :icon="ArrowRight" :disabled="!roleResult" @click="goNextSetupStep">
                确认角色
              </el-button>
            </div>
          </article>

          <article v-show="activeSetupTab === 'stage'" class="training-panel goal-card">
            <div class="stage-setting-head">
              <div>
                <ChevronUp :size="18" />
                <strong>开放式设置</strong>
                <span>不要求流程顺序，围绕核心目标展开对话完成要求。</span>
              </div>
              <em>{{ goalSetting ? `${goalSetting.round_limit} 轮` : 'LLM 动态轮数' }}</em>
            </div>
            <template v-if="goalSetting && goalStage">
              <section class="open-stage-card">
                <header>
                  <div>
                    <span>{{ goalSetting.training_purpose }}</span>
                    <h3>{{ goalStage.stage_name }}</h3>
                  </div>
                  <em>对话轮数：{{ goalSetting.round_limit }}</em>
                </header>
                <p class="open-stage-goal">
                  <Target :size="17" />
                  <b>目标：</b>
                  <span>{{ goalStage.core_goal }}</span>
                </p>
                <div class="stage-condition-list">
                  <section>
                    <b>目标达成条件</b>
                    <ol>
                      <li v-for="item in goalStage.success_conditions" :key="item">{{ item }}</li>
                    </ol>
                  </section>
                  <section>
                    <b>目标失败条件</b>
                    <ol>
                      <li v-for="item in goalStage.failure_conditions" :key="item">{{ item }}</li>
                    </ol>
                  </section>
                </div>
              </section>
            </template>
            <div v-else class="training-empty">
              <Gauge :size="28" />
              <span>{{ roleResult ? '由 LLM 根据 AI 客户生成训练阶段、目标与轮数。' : '请先完成 AI 客户角色生成。' }}</span>
            </div>
            <div class="setup-flow-actions">
              <el-button class="tech-button ghost" :icon="ArrowLeft" @click="goPreviousSetupStep">
                上一步
              </el-button>
              <div>
                <strong>再生成训练阶段</strong>
                <span>开放式训练当前只有一个阶段，会生成训练宗旨、核心目标、达成条件、失败条件和对话轮数。</span>
              </div>
              <el-button class="tech-button primary" :icon="Gauge" :disabled="!roleResult" :loading="generatingGoal" @click="generateGoal">
                {{ goalSetting ? '重新生成训练阶段' : '生成训练阶段' }}
              </el-button>
              <el-button class="tech-button" :icon="ArrowRight" :disabled="!goalSetting" @click="goNextSetupStep">
                下一步
              </el-button>
            </div>
          </article>

          <article v-show="activeSetupTab === 'score'" class="training-panel score-rule-panel">
            <div class="panel-title panel-title-between">
              <span><Trophy :size="16" /> 评分设置</span>
              <em>{{ goalSetting ? '100 分' : '待生成' }}</em>
            </div>
            <template v-if="goalSetting">
              <div class="score-rule-summary">
                <strong>通用能力 40 分</strong>
                <span>固定规则</span>
                <strong>阶段能力 60 分</strong>
                <span>LLM 根据角色与目标生成</span>
              </div>
              <div class="score-rule-list">
                <section v-for="dimension in generalScoringDimensions" :key="String(dimension.dimension_name)" class="score-rule-card">
                  <b>{{ dimension.dimension_name }} · {{ dimension.score }}分</b>
                  <p v-for="point in scorePoints(dimension)" :key="String(point.point_name)">
                    {{ point.point_name }}：{{ point.score }}分 · {{ point.description }}
                  </p>
                </section>
                <section v-for="dimension in stageScoringDimensions" :key="String(dimension.dimension_name)" class="score-rule-card stage">
                  <b>{{ dimension.dimension_name }} · {{ dimension.score }}分</b>
                  <p v-for="point in scorePoints(dimension)" :key="String(point.point_name)">
                    {{ point.point_name }}：{{ point.score }}分 · {{ point.description }}
                  </p>
                </section>
              </div>
              <div class="setup-flow-actions">
                <el-button class="tech-button ghost" :icon="ArrowLeft" @click="goPreviousSetupStep">
                  上一步
                </el-button>
                <div>
                  <strong>确认后开始实战陪练</strong>
                  <span>评分规则由通用能力和阶段能力组成，训练结束后用于生成复盘报告。</span>
                </div>
                <div class="training-action-row">
                  <el-radio-group v-model="responseMode" class="training-mode-switch" size="small">
                    <el-radio-button value="stream">流式</el-radio-button>
                    <el-radio-button value="blocking">一次性</el-radio-button>
                  </el-radio-group>
                  <el-button class="tech-button primary" :icon="Play" :loading="startingSession" @click="startSession">
                    开始训练
                  </el-button>
                </div>
              </div>
            </template>
            <div v-else class="training-empty compact">
              <Trophy :size="24" />
              <span>生成训练阶段后展示评分规则。</span>
            </div>
          </article>
        </section>

      </section>

      <aside v-if="activePlan && activeSetupTab !== 'plan'" class="training-right-panel">
        <section class="training-panel customer-profile-panel profile-summary-panel" v-loading="loadingProfileDictionaries">
          <div class="panel-title panel-title-between">
            <span><Radar :size="16" /> 客户画像</span>
            <em>{{ selectedProfileTemplate?.item_name || '未选择' }}</em>
          </div>
          <div class="profile-template-summary">
            <BrainCircuit :size="15" />
            <span>{{ selectedProfileScenario }}</span>
          </div>
          <div class="profile-chip-cloud customer">
            <span v-for="tag in customerProfileTags" :key="`customer-${tag}`" :title="tag">{{ compactText(tag) }}</span>
            <span v-if="customerProfileTags.length === 0">未配置</span>
          </div>
          <div class="profile-summary-meta">
            <span>模型档位：{{ modelModeLabel }}</span>
            <span :title="scenarioDescription">场景描述：{{ scenarioPreviewText }}</span>
            <span :title="extraDetails || '未填写'">补充细节：{{ extraDetailsPreviewText }}</span>
          </div>
          <el-button class="tech-button primary" @click="openCustomerProfileDialog">
            修改客户画像
          </el-button>
        </section>
      </aside>
    </section>

    <section v-show="activeWorkspaceTab === 'chat'" class="training-chat-workspace">
      <aside class="training-chat-side">
        <section class="training-panel">
          <div class="panel-title panel-title-between">
            <span><UserRoundCheck :size="16" /> 客户角色</span>
            <em>{{ roleResult ? '已生成' : '未生成' }}</em>
          </div>
          <div v-if="roleResult" class="chat-role-card">
            <strong>{{ roleTitleText }}</strong>
            <p>{{ roleSummaryText }}</p>
            <dl>
              <template v-for="field in chatRoleFields" :key="field.label">
                <dt>{{ field.label }}</dt>
                <dd>{{ displayValue(field.value) }}</dd>
              </template>
            </dl>
          </div>
          <div v-else class="training-empty compact">
            <Radar :size="24" />
            <span>请先在角色设置中生成 AI 客户。</span>
          </div>
        </section>
        <section class="training-panel">
          <div class="panel-title panel-title-between">
            <span><Gauge :size="16" /> 训练目标</span>
            <em>{{ goalSetting ? `${goalSetting.round_limit} 轮` : '待生成' }}</em>
          </div>
          <div v-if="goalSetting && goalStage" class="goal-core">
            <span>{{ goalSetting.training_purpose }}</span>
            <strong>{{ goalStage.core_goal }}</strong>
          </div>
          <el-button class="tech-button primary full" :icon="Play" :disabled="!roleResult || !goalSetting" :loading="startingSession" @click="startSession">
            开始训练
          </el-button>
        </section>
      </aside>

      <section class="training-chat-shell focused">
        <header class="training-chat-header">
          <div>
            <span><MessageSquareText :size="16" /> 实战对话</span>
            <strong>{{ activeSession ? `会话 ${activeSession.session_id.slice(0, 16)}...` : '等待开始' }}</strong>
          </div>
          <div class="training-chat-metrics">
            <em>{{ answeredRounds }}/{{ goalSetting?.round_limit || '-' }} 轮</em>
            <em>{{ stageStatus }}</em>
            <el-progress :percentage="progressPercent" :stroke-width="8" />
          </div>
        </header>
        <section ref="trainingWindow" class="training-message-window">
          <article v-for="message in messages" :key="message.id" class="training-message" :class="message.role">
            <span class="training-avatar">
              <UserRoundCheck v-if="message.role === 'customer'" :size="16" />
              <span v-else-if="message.role === 'trainee'">我</span>
              <Sparkles v-else :size="15" />
            </span>
            <div class="training-bubble">
              <div class="message-meta">
                <b>{{ message.role === 'customer' ? 'AI 客户' : message.role === 'trainee' ? '学员' : '系统' }}</b>
                <em>{{ message.streaming ? '生成中' : message.meta }}</em>
                <LoaderCircle v-if="message.streaming" class="spin-icon" :size="14" />
              </div>
              <p>{{ message.content || '...' }}</p>
              <div v-if="hasDisplayValue(message.analysis)" class="coach-analysis-inline">
                <b><BrainCircuit :size="14" /> 教练分析</b>
                <p>{{ displayValue(message.analysis?.summary || '') }}</p>
                <span v-for="item in safeList(message.analysis?.suggestions)" :key="item">{{ item }}</span>
              </div>
            </div>
          </article>
          <div v-if="messages.length === 0" class="training-empty in-chat">
            <MessageSquareText :size="30" />
            <strong>还没有训练对话</strong>
            <span>开始训练后，AI 客户会根据每轮检索结果进行追问、质疑或推进。</span>
          </div>
        </section>
        <footer class="training-composer">
          <div v-if="retrievedChunkIds.length" class="retrieval-strip">
            <Network :size="15" />
            <span>本轮检索：{{ retrievedChunkIds.slice(0, 5).join('、') }}</span>
          </div>
          <div class="composer-row">
            <el-input
              v-model="traineeMessage"
              type="textarea"
              :disabled="!activeSession || isReviewMode || submittingTurn || activeSession.status === 'completed'"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="输入学员回复，例如：我先了解一下您当前最担心的是成本、交付周期还是效果不确定？"
              @keydown.ctrl.enter.prevent="submitTurn"
            />
            <div class="composer-actions">
              <el-button class="tech-button primary" :icon="Send" :disabled="!activeSession || isReviewMode" :loading="submittingTurn" @click="submitTurn">
                发送
              </el-button>
              <el-button class="tech-button" :icon="Trophy" :disabled="!activeSession || isReviewMode || answeredRounds === 0" :loading="scoring" @click="finishAndScore">
                生成评分
              </el-button>
            </div>
          </div>
        </footer>
      </section>

      <aside class="training-coach-side">
        <section class="training-panel">
          <div class="panel-title"><BrainCircuit :size="16" /> 本轮辅助分析</div>
          <template v-if="hasDisplayValue(latestCoachAnalysis)">
            <div class="coach-analysis-card">
              <strong>{{ displayValue(latestCoachAnalysis.summary || '本轮分析') }}</strong>
              <b>优势</b>
              <p v-for="item in safeList(latestCoachAnalysis.strengths)" :key="item">{{ item }}</p>
              <b>建议</b>
              <p v-for="item in safeList(latestCoachAnalysis.suggestions)" :key="item">{{ item }}</p>
              <em>{{ displayValue(latestCoachAnalysis.next_reply_hint || '') }}</em>
            </div>
          </template>
          <div v-else class="training-empty compact">
            <BrainCircuit :size="24" />
            <span>发送一轮回复后展示销售辅助建议。</span>
          </div>
        </section>
      </aside>
    </section>

    <TrainingReviewWorkspace
      v-show="activeWorkspaceTab === 'review'"
      v-model:history-page="historyPage"
      :training-histories="trainingHistories"
      :history-total="historyTotal"
      :score-result="scoreResult"
      :report="report"
      :loading-history="loadingHistory"
      :loading-detail="loadingDetail"
      :format-time="formatTime"
      @refresh-history="refreshTrainingHistory"
      @open-history="openTrainingHistory"
    />
      </main>
    </section>

    <el-dialog
      v-model="planDetailVisible"
      title="训练方案详情"
      width="1120px"
      class="profile-config-dialog training-plan-dialog"
      destroy-on-close
    >
      <section v-if="selectedPlanDetail" class="plan-detail-body">
        <div class="plan-detail-head">
          <div>
            <strong>{{ selectedPlanDetail.plan.plan_name }}</strong>
            <span>方案编号：{{ selectedPlanDetail.plan.plan_id }} · 更新时间：{{ formatTime(selectedPlanDetail.plan.updated_at) }}</span>
          </div>
          <div class="plan-status-strip">
            <span>角色：{{ selectedPlanDetail.plan.role_status }}</span>
            <span>阶段：{{ selectedPlanDetail.plan.goal_status }}</span>
            <span>评分：{{ selectedPlanDetail.plan.score_status }}</span>
            <span>模型：{{ displayOptionLabel(selectedPlanDetail.plan.model_mode || 'high', { high: '高质量', medium: '均衡', low: '低延迟' }) }}</span>
          </div>
        </div>
        <div class="plan-snapshot-overview">
          <article>
            <span>适用学员</span>
            <strong>{{ planDetailTraineeName(selectedPlanDetail) }}</strong>
            <em>{{ selectedPlanDetail.plan.trainee_id }} · {{ planDetailTraineeRole(selectedPlanDetail) }}</em>
          </article>
          <article>
            <span>客户画像模板</span>
            <strong>{{ planDetailProfileTemplateName(selectedPlanDetail) }}</strong>
            <em>画像编码：{{ selectedPlanDetail.plan.profile_type }}</em>
          </article>
          <article>
            <span>方案快照</span>
            <strong>每个训练独立保存</strong>
            <em>修改本方案不会覆盖其他训练方案</em>
          </article>
        </div>

        <section class="plan-detail-section">
          <header>
            <span>第一步</span>
            <strong>学员画像</strong>
            <em>与新增页面一致展示完整学员输入</em>
          </header>
          <div class="plan-detail-grid">
            <article v-for="item in planDetailTraineeItems(selectedPlanDetail)" :key="item.label" class="plan-detail-item">
              <span>{{ item.label }}</span>
              <strong>{{ displayValue(item.value) }}</strong>
            </article>
          </div>
        </section>

        <section class="plan-detail-section">
          <header>
            <span>第一步</span>
            <strong>客户画像与场景</strong>
            <em>{{ displayValue(selectedPlanDetail.selected_fields.画像类型 || selectedPlanDetail.plan.profile_type) }}</em>
          </header>
          <div class="plan-chip-row">
            <span>画像编码：{{ selectedPlanDetail.plan.profile_type }}</span>
            <span>模型档位：{{ displayOptionLabel(selectedPlanDetail.plan.model_mode || 'high', { high: '高质量', medium: '均衡', low: '低延迟' }) }}</span>
          </div>
          <div class="plan-detail-grid">
            <article
              v-for="[key, value] in planDetailCustomerEntries(selectedPlanDetail)"
              :key="key"
              class="plan-detail-item"
            >
              <span>{{ key }}</span>
              <strong>{{ displayValue(value) }}</strong>
            </article>
            <article class="plan-detail-item wide">
              <span>场景描述</span>
              <strong>{{ selectedPlanDetail.scenario_description }}</strong>
            </article>
            <article class="plan-detail-item wide">
              <span>补充细节</span>
              <strong>{{ selectedPlanDetail.extra_details || '无' }}</strong>
            </article>
          </div>
        </section>

        <section class="plan-detail-section">
          <header>
            <span>第二步</span>
            <strong>AI 客户角色</strong>
            <em>{{ hasDisplayValue(selectedPlanDetail.role_confirm_card) ? '已生成' : '未生成' }}</em>
          </header>
          <div v-if="hasDisplayValue(selectedPlanDetail.role_confirm_card) || hasDisplayValue(selectedPlanDetail.role_profile)" class="plan-object-grid">
            <article class="plan-object-card">
              <b>确认卡片</b>
              <dl>
                <template v-for="[key, value] in objectEntries(selectedPlanDetail.role_confirm_card)" :key="`confirm-${key}`">
                  <dt>{{ key }}</dt>
                  <dd>{{ displayValue(value) }}</dd>
                </template>
              </dl>
            </article>
            <article class="plan-object-card">
              <b>可见画像</b>
              <dl>
                <template v-for="[key, value] in objectEntries(selectedPlanDetail.visible_profile)" :key="`visible-${key}`">
                  <dt>{{ key }}</dt>
                  <dd>{{ displayValue(value) }}</dd>
                </template>
              </dl>
            </article>
            <article class="plan-object-card">
              <b>隐藏画像</b>
              <dl>
                <template v-for="[key, value] in objectEntries(selectedPlanDetail.hidden_profile)" :key="`hidden-${key}`">
                  <dt>{{ key }}</dt>
                  <dd>{{ displayValue(value) }}</dd>
                </template>
              </dl>
            </article>
            <article class="plan-object-card">
              <b>扮演画像</b>
              <dl>
                <template v-for="[key, value] in objectEntries(selectedPlanDetail.role_profile)" :key="`role-${key}`">
                  <dt>{{ key }}</dt>
                  <dd>{{ displayValue(value) }}</dd>
                </template>
              </dl>
            </article>
          </div>
          <div v-else class="training-empty compact">
            <BrainCircuit :size="24" />
            <span>当前方案还没有生成 AI 客户角色。</span>
          </div>
          <div v-if="selectedPlanDetail.retrieved_cases.length" class="plan-case-list">
            <b>生成角色引用案例</b>
            <article v-for="(item, index) in selectedPlanDetail.retrieved_cases.slice(0, 6)" :key="`case-${index}`">
              <strong>{{ planCaseTitle(item, index) }}</strong>
              <p>{{ compactText(planCaseSummary(item), 150) }}</p>
            </article>
          </div>
        </section>

        <section class="plan-detail-section">
          <header>
            <span>第三步</span>
            <strong>训练阶段</strong>
            <em>{{ selectedPlanDetail.goal_setting ? `${selectedPlanDetail.goal_setting.round_limit} 轮` : '未生成' }}</em>
          </header>
          <template v-if="selectedPlanDetail.goal_setting">
            <div class="plan-chip-row">
              <span>训练方式：{{ selectedPlanDetail.goal_setting.training_mode }}</span>
              <span>训练宗旨：{{ selectedPlanDetail.goal_setting.training_purpose }}</span>
            </div>
            <div class="plan-stage-list">
              <article v-for="(stage, index) in planDetailStages(selectedPlanDetail)" :key="`detail-stage-${index}`" class="plan-stage-card">
                <header>
                  <em>第 {{ stage.stage_no || index + 1 }} 阶段</em>
                  <strong>{{ displayValue(stage.stage_name || '开放式训练') }}</strong>
                </header>
                <p class="plan-stage-goal">
                  <Target :size="16" />
                  <span>{{ displayValue(stage.core_goal || '未填写核心目标') }}</span>
                </p>
                <div class="condition-grid">
                  <div>
                    <b>达成条件</b>
                    <p v-for="item in valueList(stage.success_conditions)" :key="`success-${index}-${item}`">{{ item }}</p>
                  </div>
                  <div>
                    <b>失败条件</b>
                    <p v-for="item in valueList(stage.failure_conditions)" :key="`failure-${index}-${item}`">{{ item }}</p>
                  </div>
                </div>
              </article>
            </div>
          </template>
          <div v-else class="training-empty compact">
            <Gauge :size="24" />
            <span>当前方案还没有生成训练阶段。</span>
          </div>
        </section>

        <section class="plan-detail-section">
          <header>
            <span>第四步</span>
            <strong>评分规则</strong>
            <em>{{ selectedPlanDetail.goal_setting ? '100 分' : '未生成' }}</em>
          </header>
          <template v-if="selectedPlanDetail.goal_setting">
            <div class="score-rule-summary">
              <strong>通用能力 40 分</strong>
              <span>{{ planDetailGeneralDimensions(selectedPlanDetail).length }} 个维度</span>
              <strong>阶段能力 60 分</strong>
              <span>{{ planDetailStageDimensions(selectedPlanDetail).length }} 个维度</span>
            </div>
            <div class="score-rule-list plan-score-list">
              <section
                v-for="dimension in planDetailGeneralDimensions(selectedPlanDetail)"
                :key="`detail-general-${String(dimension.dimension_name)}`"
                class="score-rule-card"
              >
                <b>{{ dimension.dimension_name }} · {{ dimension.score }}分</b>
                <p v-for="point in scorePoints(dimension)" :key="String(point.point_name)">
                  {{ point.point_name }}：{{ point.score }}分 · {{ point.description }}
                </p>
              </section>
              <section
                v-for="dimension in planDetailStageDimensions(selectedPlanDetail)"
                :key="`detail-stage-score-${String(dimension.dimension_name)}`"
                class="score-rule-card stage"
              >
                <b>{{ dimension.dimension_name }} · {{ dimension.score }}分</b>
                <p v-for="point in scorePoints(dimension)" :key="String(point.point_name)">
                  {{ point.point_name }}：{{ point.score }}分 · {{ point.description }}
                </p>
              </section>
            </div>
          </template>
          <div v-else class="training-empty compact">
            <Trophy :size="24" />
            <span>生成训练阶段后会展示评分规则。</span>
          </div>
        </section>
      </section>
      <template #footer>
        <el-button @click="planDetailVisible = false">关闭</el-button>
        <el-button type="primary" @click="openPlanEditDialog">修改</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="planEditVisible"
      title="修改训练方案"
      width="1120px"
      class="profile-config-dialog training-plan-dialog"
      destroy-on-close
    >
      <section class="plan-edit-body">
        <div class="plan-edit-note">
          <ShieldCheck :size="17" />
          <span>
            当前编辑的是“{{ planEditDraft.traineeName || '销售学员' }}”
            使用“{{ planEditSelectedProfileTemplate?.item_name || planEditDraft.profileType }}”生成的独立训练方案。
            修改学员画像、客户画像或场景后，本方案的角色、阶段和评分会标记为需重新生成，其他训练方案不受影响。
          </span>
        </div>

        <section class="plan-edit-section">
          <header>
            <span>基础信息</span>
            <strong>方案和模型</strong>
          </header>
          <div class="training-form-grid two">
            <label>
              <span>训练名称</span>
              <el-input v-model="planEditDraft.planName" maxlength="80" show-word-limit />
            </label>
            <label>
              <span>模型档位</span>
              <el-select v-model="planEditDraft.modelMode">
                <el-option label="高质量" value="high" />
                <el-option label="均衡" value="medium" />
                <el-option label="低延迟" value="low" />
              </el-select>
            </label>
          </div>
        </section>

        <section class="plan-edit-section">
          <header>
            <span>第一步</span>
            <strong>学员画像</strong>
          </header>
          <div class="training-form-grid two">
            <label>
              <span>学员编号</span>
              <el-input v-model="planEditDraft.traineeId" />
            </label>
            <label>
              <span>学员名称</span>
              <el-input v-model="planEditDraft.traineeName" />
            </label>
            <label>
              <span>职位角色</span>
              <el-select v-model="planEditDraft.positionRole" filterable>
                <el-option v-for="option in positionRoleOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </label>
            <label>
              <span>经验等级</span>
              <el-select v-model="planEditDraft.experienceLevel" filterable>
                <el-option v-for="option in experienceLevelOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </label>
            <label>
              <span>任务目标</span>
              <el-select v-model="planEditDraft.taskGoal" filterable>
                <el-option v-for="option in taskGoalOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </label>
            <label>
              <span>短板标签</span>
              <el-select
                v-model="planEditDraft.weaknessTags"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="请选择短板标签"
              >
                <el-option v-for="option in weaknessTagOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </label>
            <label class="wide">
              <span>其他说明</span>
              <el-input
                v-model="planEditDraft.studentPortraitOther"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="补充学员背景、近期训练重点或特殊说明"
              />
            </label>
          </div>
        </section>

        <section class="plan-edit-section">
          <header>
            <span>第一步</span>
            <strong>客户画像</strong>
            <em>{{ planEditSelectedProfileTemplate?.item_name || planEditDraft.profileType }}</em>
          </header>
          <div class="profile-template-switch dialog-template-switch plan-edit-template-switch" role="tablist" aria-label="编辑客户画像类型">
            <button
              v-for="template in customerProfileTemplates"
              :key="`edit-template-${template.item_code}`"
              type="button"
              :class="{ active: planEditDraft.profileType === template.item_code }"
              @click="applyPlanEditProfileTemplate(template.item_code)"
            >
              <strong>{{ template.item_name }}</strong>
              <span>{{ template.description || template.metadata?.scenario_summary || '客户画像模板' }}</span>
            </button>
          </div>
          <div class="profile-template-summary">
            <BrainCircuit :size="15" />
            <span>{{ planEditProfileScenario }}</span>
          </div>

          <div v-for="group in planEditCustomerProfileFieldGroups" :key="`edit-${group.title}`" class="dialog-field-group">
            <b>{{ group.title }}</b>
            <div class="profile-dialog-grid">
              <label
                v-for="field in group.fields"
                :key="`edit-field-${field.itemCode}`"
                class="dialog-profile-field"
                :class="{ wide: isTextAreaField(field) || isMultiSelectField(field) }"
              >
                <span>{{ field.label }}</span>
                <el-select
                  v-if="field.inputType === 'select' || isMultiSelectField(field)"
                  v-model="planEditDraft.customerProfileValues[field.fieldKey]"
                  :multiple="isMultiSelectField(field)"
                  filterable
                  :allow-create="field.options.length === 0"
                  default-first-option
                  collapse-tags
                  collapse-tags-tooltip
                  :placeholder="field.description || field.label"
                >
                  <el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value" />
                </el-select>
                <el-input
                  v-else-if="isTextAreaField(field)"
                  v-model="planEditDraft.customerProfileValues[field.fieldKey]"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 4 }"
                  :placeholder="field.description || field.label"
                />
                <el-input
                  v-else
                  v-model="planEditDraft.customerProfileValues[field.fieldKey]"
                  :placeholder="field.description || field.label"
                />
                <em>{{ field.fieldKey }}</em>
              </label>
            </div>
          </div>
        </section>

        <section class="plan-edit-section">
          <header>
            <span>第一步</span>
            <strong>训练场景</strong>
          </header>
          <div class="dialog-field-group">
            <b>场景描述</b>
            <el-input v-model="planEditDraft.scenarioDescription" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </div>
          <div class="dialog-field-group">
            <b>补充细节</b>
            <el-input v-model="planEditDraft.extraDetails" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
          </div>
        </section>

        <section class="plan-edit-section">
          <header>
            <span>第三步</span>
            <strong>训练阶段</strong>
          </header>
          <div class="training-form-grid two">
            <label>
              <span>训练宗旨</span>
              <el-input v-model="planEditDraft.trainingPurpose" placeholder="例如：训练客户顾虑挖掘和下一步推进能力" />
            </label>
            <label>
              <span>训练轮数</span>
              <el-input-number v-model="planEditDraft.roundLimit" :min="0" :max="100" :step="1" controls-position="right" />
            </label>
          </div>
          <div class="dialog-field-group">
            <b>阶段配置 JSON</b>
            <el-input v-model="planEditDraft.stagesJson" type="textarea" :autosize="{ minRows: 6, maxRows: 12 }" />
          </div>
        </section>

        <section class="plan-edit-section">
          <header>
            <span>高级配置</span>
            <strong>角色与评分完整结构</strong>
            <em>复杂字段保持 JSON，便于完整保留后端结构</em>
          </header>
          <el-collapse v-model="planEditAdvancedPanels" class="plan-edit-collapse">
            <el-collapse-item title="第二步：AI 客户角色" name="role">
              <div class="plan-json-grid">
                <label>
                  <span>确认卡片 JSON</span>
                  <el-input v-model="planEditDraft.roleConfirmCardJson" type="textarea" :autosize="{ minRows: 5, maxRows: 12 }" />
                </label>
                <label>
                  <span>可见画像 JSON</span>
                  <el-input v-model="planEditDraft.visibleProfileJson" type="textarea" :autosize="{ minRows: 5, maxRows: 12 }" />
                </label>
                <label>
                  <span>隐藏画像 JSON</span>
                  <el-input v-model="planEditDraft.hiddenProfileJson" type="textarea" :autosize="{ minRows: 5, maxRows: 12 }" />
                </label>
                <label>
                  <span>扮演画像 JSON</span>
                  <el-input v-model="planEditDraft.roleProfileJson" type="textarea" :autosize="{ minRows: 5, maxRows: 12 }" />
                </label>
              </div>
            </el-collapse-item>
            <el-collapse-item title="第四步：评分规则" name="score">
              <div class="dialog-field-group">
                <b>评分规则 JSON</b>
                <el-input v-model="planEditDraft.scoringRulesJson" type="textarea" :autosize="{ minRows: 8, maxRows: 16 }" />
              </div>
            </el-collapse-item>
          </el-collapse>
        </section>
      </section>
      <template #footer>
        <el-button @click="planEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPlanEdit" @click="savePlanEdit">保存</el-button>
      </template>
    </el-dialog>



    <el-dialog
      v-model="supplementDialogVisible"
      width="980px"
      class="profile-config-dialog supplement-dialog"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <template #header>
        <div class="supplement-dialog-title">
          <FileText :size="22" />
          <strong>补充问答场景细节</strong>
          <span>填写以下信息，让剧本生成更精准，贴合真实业务挑战</span>
        </div>
      </template>
      <div class="supplement-question-list">
        <section v-for="question in supplementQuestions" :key="question.question_id" class="supplement-question-card">
          <div class="supplement-question-head">
            <em>{{ question.question_no }}</em>
            <strong>{{ question.question }}</strong>
          </div>
          <el-radio-group v-model="supplementAnswers[question.question_id]" class="supplement-option-grid">
            <el-radio
              v-for="option in question.options"
              :key="`${question.question_id}-${option.option_code}`"
              :value="option.option_code"
              border
            >
              {{ option.option_code }}. {{ option.option_text }}
            </el-radio>
          </el-radio-group>
          <el-input
            v-if="question.allow_other"
            v-model="supplementOtherAnswers[question.question_id]"
            class="supplement-other-input"
            placeholder="其他补充，可不填"
            clearable
          />
        </section>
        <div v-if="supplementQuestions.length === 0" class="training-empty compact">
          <FileText :size="24" />
          <span>暂无补充问题，请重新生成。</span>
        </div>
      </div>
      <template #footer>
        <div class="supplement-dialog-footer">
          <el-button @click="supplementDialogVisible = false">取消</el-button>
          <el-button :loading="generatingSupplementQuestions" @click="prepareRoleGeneration">重新生成问题</el-button>
          <el-button type="primary" :loading="generatingRole" @click="confirmSupplementAndGenerateRole">
            确认并生成 AI 客户
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="traineeProfileDialogVisible"
      title="学员画像"
      width="720px"
      class="profile-config-dialog"
      destroy-on-close
    >
      <section class="profile-dialog-body">
        <div class="profile-dialog-card">
          <div class="dialog-field-group">
            <b>基础信息</b>
            <div class="training-form-grid two">
              <label>
                <span>学员编号</span>
                <el-input v-model="traineeProfileDraft.traineeId" />
              </label>
              <label>
                <span>学员名称</span>
                <el-input v-model="traineeProfileDraft.traineeName" />
              </label>
              <label>
                <span>职位角色</span>
                <el-select v-model="traineeProfileDraft.positionRole" filterable>
                  <el-option
                    v-for="option in positionRoleOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </label>
              <label>
                <span>经验等级</span>
                <el-select v-model="traineeProfileDraft.experienceLevel" filterable>
                  <el-option
                    v-for="option in experienceLevelOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </label>
              <label>
                <span>任务目标</span>
                <el-select v-model="traineeProfileDraft.taskGoal" filterable>
                  <el-option
                    v-for="option in taskGoalOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </label>
            </div>
          </div>
          <div class="dialog-field-group">
            <b>短板标签</b>
            <el-select
              v-model="traineeProfileDraft.weaknessTags"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择短板标签"
            >
              <el-option
                v-for="option in weaknessTagOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
          <div class="dialog-field-group">
            <b>其他</b>
            <el-input
              v-model="traineeProfileDraft.studentPortraitOther"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="补充学员背景、近期训练重点或特殊说明"
            />
          </div>
          <div class="profile-chip-cloud preview">
            <span>职位：{{ draftPositionRoleLabel || '未填写职位' }}</span>
            <span>经验：{{ draftExperienceLevelLabel }}</span>
            <span>目标：{{ draftTaskGoalLabel }}</span>
            <span v-for="tag in draftWeaknessTagLabels" :key="`draft-trainee-${tag}`">{{ tag }}</span>
            <span
              v-if="traineeProfileDraft.studentPortraitOther"
              :title="`其他：${traineeProfileDraft.studentPortraitOther}`"
            >
              {{ compactText(`其他：${traineeProfileDraft.studentPortraitOther}`) }}
            </span>
          </div>
        </div>
      </section>
      <template #footer>
        <el-button @click="traineeProfileDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmTraineeProfileDialog">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="customerProfileDialogVisible"
      title="客户画像"
      width="920px"
      class="profile-config-dialog customer-dialog"
      destroy-on-close
    >
      <section class="profile-dialog-body">
        <div class="profile-dialog-card">
          <div class="dialog-field-group">
            <b>职位角色</b>
            <div class="profile-template-switch dialog-template-switch" role="tablist" aria-label="客户画像类型">
              <button
                v-for="template in customerProfileTemplates"
                :key="template.item_code"
                type="button"
                :class="{ active: draftProfileType === template.item_code }"
                @click="applyDraftProfileTemplate(template.item_code)"
              >
                <strong>{{ template.item_name }}</strong>
                <span>{{ template.description || template.metadata?.scenario_summary || '客户画像模板' }}</span>
              </button>
            </div>
            <div class="profile-template-summary">
              <BrainCircuit :size="15" />
              <span>{{ draftProfileScenario }}</span>
            </div>
          </div>

          <div
            v-for="group in draftCustomerProfileFieldGroups"
            :key="group.title"
            class="dialog-field-group"
          >
            <b>{{ group.title }}</b>
            <div class="profile-dialog-grid">
              <label
                v-for="field in group.fields"
                :key="field.itemCode"
                class="dialog-profile-field"
                :class="{ wide: isTextAreaField(field) || isMultiSelectField(field) }"
              >
                <span>{{ field.label }}</span>
                <el-select
                  v-if="field.inputType === 'select' || isMultiSelectField(field)"
                  v-model="draftCustomerProfileValues[field.fieldKey]"
                  :multiple="isMultiSelectField(field)"
                  filterable
                  :allow-create="field.options.length === 0"
                  default-first-option
                  collapse-tags
                  collapse-tags-tooltip
                  :placeholder="field.description || field.label"
                >
                  <el-option
                    v-for="option in field.options"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
                <el-input
                  v-else-if="isTextAreaField(field)"
                  v-model="draftCustomerProfileValues[field.fieldKey]"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 4 }"
                  :placeholder="field.description || field.label"
                />
                <el-input v-else v-model="draftCustomerProfileValues[field.fieldKey]" :placeholder="field.description || field.label" />
                <em>{{ field.fieldKey }}</em>
              </label>
            </div>
          </div>

          <div class="dialog-field-group">
            <b>训练设置</b>
            <div class="training-form-grid two">
              <label>
                <span>模型档位</span>
                <el-select v-model="draftModelMode">
                  <el-option label="高质量" value="high" />
                  <el-option label="均衡" value="medium" />
                  <el-option label="低延迟" value="low" />
                </el-select>
              </label>
              <label>
                <span>画像编码</span>
                <el-input v-model="draftProfileType" disabled />
              </label>
            </div>
          </div>

          <div class="dialog-field-group">
            <div class="dialog-field-title-row">
              <b>场景描述</b>
              <el-button
                class="tech-button compact"
                :icon="Sparkles"
                :loading="polishingScenario"
                @click="polishScenarioDescription"
              >
                AI 润色
              </el-button>
            </div>
            <el-input v-model="draftScenarioDescription" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
          </div>
          <div class="dialog-field-group">
            <b>补充细节</b>
            <el-input v-model="draftExtraDetails" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
          </div>
        </div>
      </section>
      <template #footer>
        <el-button @click="customerProfileDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCustomerProfileDialog">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sales-training-page {
  display: grid;
  gap: 12px;
}

.sales-training-hero {
  min-height: 112px;
}

.training-console-layout {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.training-workspace-rail {
  position: sticky;
  top: 14px;
  display: grid;
  gap: 12px;
}

.training-workspace-stage {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.training-next-card {
  position: relative;
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 156px;
  border: 1px solid color-mix(in srgb, var(--cyan) 26%, var(--line));
  border-radius: 18px;
  padding: 16px;
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--cyan) 18%, transparent), transparent 34%),
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface) 82%, transparent);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.training-next-card.compact {
  min-height: auto;
  border-radius: 8px;
  padding: 14px;
}

.training-next-card::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--cyan) 8%, transparent) 1px, transparent 1px),
    linear-gradient(180deg, color-mix(in srgb, var(--cyan) 7%, transparent) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: linear-gradient(120deg, black, transparent 70%);
  opacity: 0.42;
}

.training-next-card > * {
  position: relative;
}

.next-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.next-card-header span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: color-mix(in srgb, var(--text) 78%, var(--cyan));
  font-size: 12px;
  font-weight: 800;
}

.next-card-header em {
  border: 1px solid color-mix(in srgb, var(--green) 30%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: color-mix(in srgb, var(--text) 70%, var(--green));
  background: color-mix(in srgb, var(--green) 8%, transparent);
  font-size: 12px;
  font-style: normal;
  white-space: nowrap;
}

.training-next-card strong {
  color: var(--text);
  font-size: 20px;
}

.training-next-card p {
  margin: 0;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.7;
}

.readiness-bar {
  height: 8px;
  border: 1px solid color-mix(in srgb, var(--cyan) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 76%, transparent);
  overflow: hidden;
}

.readiness-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--cyan), var(--primary), var(--green));
  box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 48%, transparent);
  transition: width 0.24s ease;
}

.next-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: fit-content;
  min-height: 36px;
  border: 1px solid color-mix(in srgb, var(--cyan) 48%, var(--primary));
  border-radius: 999px;
  padding: 0 13px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--cyan));
  cursor: pointer;
  font-weight: 800;
  box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 22%, transparent);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.next-action-button:hover {
  box-shadow: 0 0 24px color-mix(in srgb, var(--cyan) 32%, transparent);
  transform: translateY(-1px);
}

.training-workspace-nav {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--line) 82%, var(--cyan) 16%);
  border-radius: 8px;
  padding: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface) 84%, transparent);
}

.training-workspace-nav button {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 8px;
  padding: 10px;
  color: var(--text);
  text-align: left;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 6%, transparent), transparent 50%),
    color-mix(in srgb, var(--surface-strong) 68%, transparent);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.training-workspace-nav button:hover,
.training-workspace-nav button.ready {
  border-color: color-mix(in srgb, var(--cyan) 46%, var(--line));
}

.training-workspace-nav button:hover {
  box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 14%, transparent);
  transform: translateY(-1px);
}

.training-workspace-nav button.active {
  border-color: color-mix(in srgb, var(--cyan) 68%, var(--primary));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), transparent 56%),
    color-mix(in srgb, var(--surface-strong) 88%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--cyan) 18%, transparent);
}

.workspace-nav-icon {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--cyan) 28%, var(--line));
  border-radius: 8px;
  color: var(--cyan);
  background: color-mix(in srgb, var(--surface-strong) 72%, transparent);
}

.training-workspace-nav button.ready .workspace-nav-icon {
  color: var(--green);
  border-color: color-mix(in srgb, var(--green) 36%, var(--line));
}

.training-workspace-nav button > span:not(.workspace-nav-icon) {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.training-workspace-nav button strong {
  overflow: hidden;
  color: var(--text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-workspace-nav button em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  line-height: 1.45;
}

.training-workspace-nav button b {
  overflow: hidden;
  color: var(--cyan);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-workspace-nav button small {
  grid-column: 2 / 4;
  width: fit-content;
  border: 1px solid color-mix(in srgb, var(--green) 24%, var(--line));
  border-radius: 999px;
  padding: 2px 7px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--green) 6%, transparent);
  font-size: 11px;
  white-space: nowrap;
}

.training-hero-actions,
.training-action-row,
.session-start-bar,
.composer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, var(--line));
  border-radius: 999px;
  padding: 8px 11px;
  color: var(--text);
  background:
    linear-gradient(180deg, color-mix(in srgb, #fff 12%, transparent), transparent),
    color-mix(in srgb, var(--surface) 78%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent);
  font-size: 12px;
}

.hero-chip-button {
  min-height: 38px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.hero-chip-button:hover,
.hero-chip-button.active {
  border-color: color-mix(in srgb, var(--cyan) 70%, var(--primary));
  box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 24%, transparent);
  transform: translateY(-1px);
}

.hero-chip-button.active {
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--cyan));
}

.hero-chip-button em {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  border-radius: 999px;
  padding: 2px 7px;
  color: inherit;
  font-size: 11px;
  font-style: normal;
  background: color-mix(in srgb, var(--surface-strong) 52%, transparent);
}

.training-panel,
.training-chat-shell {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--line) 78%, var(--cyan) 18%);
  border-radius: 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 7%, transparent), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 95%, transparent), color-mix(in srgb, var(--surface-2) 88%, transparent));
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.training-panel::before,
.training-chat-shell::before {
  position: absolute;
  top: 0;
  right: 14px;
  left: 14px;
  height: 2px;
  content: '';
  background: linear-gradient(90deg, transparent, var(--cyan), var(--primary), transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 60%, transparent);
}

.training-workspace {
  display: grid;
  grid-template-columns: minmax(230px, 290px) minmax(720px, 1fr) minmax(360px, 420px);
  gap: 14px;
  align-items: start;
}

.training-workspace.plan-step-workspace {
  grid-template-columns: minmax(0, 1fr);
}

.training-workspace.plan-step-workspace.has-left-panel {
  grid-template-columns: minmax(230px, 290px) minmax(0, 1fr);
}

.training-left-panel,
.training-right-panel,
.training-main-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
}

@media (min-width: 1321px) {
  .training-left-panel,
  .training-right-panel {
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-gutter: stable;
  }
}

.training-panel {
  padding: 13px;
}

.training-panel > * {
  min-width: 0;
}

.training-field span,
.training-form-grid span {
  color: var(--text-muted);
  font-size: 12px;
}

.training-form-grid {
  display: grid;
  gap: 10px;
}

.training-form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.training-form-grid.four {
  grid-template-columns: repeat(4, minmax(132px, 1fr));
}

.training-left-panel .training-form-grid.two {
  grid-template-columns: 1fr;
}

.training-form-grid label,
.training-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field-label-with-help {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
}

.panel-title-with-help {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.panel-title-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.panel-title-actions .el-button {
  height: 26px;
  padding: 0 8px;
  color: color-mix(in srgb, var(--cyan) 78%, var(--text));
}

.panel-title-with-help svg:last-child,
.field-label-with-help svg {
  color: color-mix(in srgb, var(--cyan) 78%, var(--text-muted));
  cursor: help;
}

.training-field {
  margin-top: 10px;
}

.profile-template-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 10px;
}

.profile-template-switch button {
  display: grid;
  gap: 6px;
  min-height: 82px;
  border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
  border-radius: 14px;
  padding: 11px;
  color: var(--text);
  text-align: left;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface) 72%, transparent);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.profile-template-switch button:hover,
.profile-template-switch button.active {
  border-color: color-mix(in srgb, var(--cyan) 70%, var(--primary));
  box-shadow: 0 0 20px color-mix(in srgb, var(--cyan) 18%, transparent);
  transform: translateY(-1px);
}

.profile-template-switch button.active {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-strong) 76%, transparent);
}

.profile-template-switch strong {
  color: var(--primary);
  font-size: 14px;
}

.profile-template-switch span,
.profile-template-summary,
.profile-field em {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.profile-template-summary {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--cyan) 22%, var(--line));
  border-radius: 12px;
  margin-bottom: 10px;
  padding: 9px 10px;
  background: color-mix(in srgb, var(--surface) 64%, transparent);
}

.profile-summary-panel {
  display: grid;
  gap: 12px;
}

.profile-chip-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, var(--line));
  border-radius: 14px;
  padding: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 6%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface-strong) 62%, transparent);
}

.profile-chip-cloud span {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--cyan) 34%, var(--line));
  border-radius: 999px;
  padding: 6px 13px;
  color: color-mix(in srgb, var(--text) 82%, var(--cyan));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 12%, transparent), transparent 50%),
    color-mix(in srgb, var(--surface) 74%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent);
  font-size: 12px;
  font-weight: 700;
}

.profile-chip-cloud.customer span {
  border-color: color-mix(in srgb, var(--green) 34%, var(--line));
  color: color-mix(in srgb, var(--text) 82%, var(--green));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--green) 11%, transparent), transparent 50%),
    color-mix(in srgb, var(--surface) 74%, transparent);
}

.profile-summary-meta {
  display: grid;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.profile-summary-meta span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.profile-dynamic-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 10px;
  margin-bottom: 10px;
}

.training-right-panel .customer-profile-panel {
  overflow: hidden;
  border-color: color-mix(in srgb, var(--cyan) 30%, var(--line));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--cyan) 8%, transparent), transparent 38%),
    linear-gradient(315deg, color-mix(in srgb, var(--primary) 9%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface) 94%, transparent);
}

.training-right-panel .customer-profile-panel :deep(.el-input__wrapper),
.training-right-panel .customer-profile-panel :deep(.el-select__wrapper) {
  min-height: 34px;
}

.training-right-panel .customer-profile-panel :deep(.el-textarea__inner) {
  min-height: 58px !important;
}

.training-right-panel .customer-profile-panel .panel-title {
  border-bottom: 1px solid color-mix(in srgb, var(--cyan) 18%, transparent);
  margin: -2px 0 12px;
  padding-bottom: 10px;
}

.training-right-panel .profile-template-switch {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.training-right-panel .profile-template-switch button {
  min-height: 66px;
  border-radius: 12px;
  padding: 10px 11px;
}

.training-right-panel .profile-template-switch span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.training-right-panel .profile-template-switch button.active {
  position: relative;
}

.training-right-panel .profile-template-switch button.active::before {
  content: '';
  position: absolute;
  inset: 8px auto 8px 8px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--cyan), var(--primary));
  box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 50%, transparent);
}

.training-right-panel .profile-template-switch button.active strong,
.training-right-panel .profile-template-switch button.active span {
  padding-left: 10px;
}

.training-right-panel .profile-dynamic-grid {
  grid-template-columns: 1fr;
  max-height: 360px;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--cyan) 16%, var(--line));
  border-radius: 14px;
  padding: 10px;
  background: color-mix(in srgb, var(--surface-strong) 56%, transparent);
}

.training-right-panel .profile-field {
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  border-radius: 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
}

.training-right-panel .profile-field > span {
  color: color-mix(in srgb, var(--text) 76%, var(--cyan));
  font-weight: 700;
}

.training-right-panel .profile-field em {
  display: -webkit-box;
  min-height: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.training-right-panel .customer-profile-panel .training-action-row {
  position: sticky;
  bottom: -13px;
  margin: 12px -13px -13px;
  border-top: 1px solid color-mix(in srgb, var(--cyan) 18%, transparent);
  padding: 10px 13px 13px;
  background:
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--surface) 94%, transparent) 18%),
    color-mix(in srgb, var(--surface) 96%, transparent);
}

.training-right-panel .profile-field.wide-field {
  grid-column: 1 / -1;
}

.training-right-panel .profile-field em {
  white-space: normal;
}

.profile-dynamic-grid .training-field {
  margin-top: 0;
}

.profile-field em {
  min-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.profile-config-dialog .el-dialog) {
  border: 1px solid color-mix(in srgb, var(--line) 72%, var(--cyan) 18%);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 5%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: 0 22px 60px color-mix(in srgb, #000 28%, transparent);
}

:deep(.profile-config-dialog .el-dialog__header) {
  margin: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  padding: 18px 20px;
}

:deep(.profile-config-dialog .el-dialog__title) {
  color: var(--text);
  font-size: 18px;
  font-weight: 800;
}

:deep(.profile-config-dialog .el-dialog__body) {
  padding: 18px 20px;
}

:deep(.profile-config-dialog .el-dialog__footer) {
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  padding: 14px 20px 18px;
}

.profile-dialog-body {
  display: grid;
  gap: 14px;
}

.profile-dialog-card {
  display: grid;
  gap: 17px;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: 8px;
  padding: 20px;
  background: color-mix(in srgb, var(--surface-strong) 56%, transparent);
}

.dialog-field-group {
  display: grid;
  gap: 10px;
}

.dialog-field-group b {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--text);
  font-size: 13px;
}

.dialog-field-group b i {
  color: #ef4444;
  font-style: normal;
}

.dialog-field-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dialog-field-title-row .tech-button.compact {
  min-height: 30px;
  padding: 6px 12px;
  border-color: color-mix(in srgb, var(--cyan) 48%, var(--line));
  color: color-mix(in srgb, var(--text) 86%, var(--cyan));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 16%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-strong) 76%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent),
    0 0 16px color-mix(in srgb, var(--cyan) 10%, transparent);
}

.profile-dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.profile-dialog-grid.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dialog-template-switch {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 0;
}

.dialog-template-switch button {
  min-height: 48px;
  border-radius: 999px;
  padding: 9px 13px;
}

.dialog-template-switch span {
  display: none;
}

.dialog-profile-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.dialog-profile-field.wide {
  grid-column: 1 / -1;
}

.dialog-profile-field > span {
  color: color-mix(in srgb, var(--text) 82%, var(--cyan));
  font-size: 12px;
  font-weight: 800;
}

.dialog-profile-field > em {
  color: var(--text-muted);
  font-size: 11px;
  font-style: normal;
}

:deep(.profile-config-dialog .el-input__wrapper),
:deep(.profile-config-dialog .el-select__wrapper),
:deep(.profile-config-dialog .el-textarea__inner) {
  border-color: transparent;
  border-radius: 8px;
  color: var(--text);
  background: color-mix(in srgb, var(--surface-2) 82%, #f2f4f7 18%);
  box-shadow: none;
}

:deep(.profile-config-dialog .el-input__wrapper),
:deep(.profile-config-dialog .el-select__wrapper) {
  min-height: 38px;
}

.supplement-dialog-title {
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--text);
  text-align: center;
}

.supplement-dialog-title svg {
  color: var(--primary);
}

.supplement-dialog-title strong {
  font-size: 22px;
}

.supplement-dialog-title span {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
}

.supplement-question-list {
  display: grid;
  gap: 24px;
  max-height: 68vh;
  overflow: auto;
  padding: 6px 2px 2px;
}

.supplement-question-card {
  display: grid;
  gap: 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  padding-bottom: 22px;
}

.supplement-question-card:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.supplement-question-head {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.supplement-question-head em {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  color: color-mix(in srgb, var(--primary) 82%, #fff);
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  font-style: normal;
  font-weight: 800;
}

.supplement-question-head strong {
  padding-top: 4px;
  color: var(--text);
  font-size: 17px;
  line-height: 1.55;
}

.supplement-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  padding-left: 50px;
}

.supplement-option-grid :deep(.el-radio) {
  display: flex;
  align-items: center;
  height: auto;
  min-height: 54px;
  margin: 0;
  border-color: color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 14px;
  padding: 10px 14px;
  color: var(--text-soft);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  white-space: normal;
}

.supplement-option-grid :deep(.el-radio.is-checked) {
  border-color: color-mix(in srgb, var(--primary) 70%, var(--cyan));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 13%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 80%, transparent);
}

.supplement-option-grid :deep(.el-radio__label) {
  color: inherit;
  line-height: 1.5;
  white-space: normal;
}

.supplement-other-input {
  padding-left: 50px;
}

.supplement-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.profile-chip-cloud.preview {
  border-style: dashed;
  padding: 10px;
}

.training-plan-panel {
  border-color: color-mix(in srgb, var(--primary) 28%, var(--line));
}

.active-plan-brief {
  border-color: color-mix(in srgb, var(--cyan) 28%, var(--line));
}

.plan-step-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(360px, 1.1fr);
  gap: 14px;
}

.plan-step-create,
.plan-step-list {
  display: grid;
  align-content: start;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--cyan) 20%, var(--line));
  border-radius: 14px;
  padding: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-strong) 58%, transparent);
}

.plan-step-create strong {
  color: var(--text);
  font-size: 17px;
}

.plan-step-create span,
.plan-step-create p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.training-plan-create,
.training-plan-filter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.active-plan-card,
.training-plan-list-item {
  display: grid;
  gap: 5px;
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--cyan) 24%, var(--line));
  border-radius: 12px;
  padding: 10px;
  color: var(--text);
  text-align: left;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 8%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface) 72%, transparent);
}

.active-plan-card strong,
.training-plan-open strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-plan-card span,
.training-plan-open span {
  color: var(--text-muted);
  font-size: 12px;
}

.active-plan-card div {
  display: flex;
  gap: 8px;
}

.training-plan-list {
  display: grid;
  gap: 8px;
  min-height: 80px;
}

.training-plan-list-item {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.training-plan-open {
  display: grid;
  min-width: 0;
  gap: 5px;
  border: 0;
  padding: 0;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.training-plan-list-item.active {
  border-color: color-mix(in srgb, var(--cyan) 72%, var(--primary));
  box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 18%, transparent);
}

.training-plan-delete {
  --el-button-bg-color: color-mix(in srgb, var(--danger) 10%, transparent);
  --el-button-border-color: color-mix(in srgb, var(--danger) 36%, var(--line));
  --el-button-hover-bg-color: color-mix(in srgb, var(--danger) 18%, transparent);
  --el-button-hover-border-color: color-mix(in srgb, var(--danger) 58%, var(--line));
  --el-button-text-color: color-mix(in srgb, var(--danger) 82%, var(--text));
  width: 30px;
  height: 30px;
}

.plan-detail-body,
.plan-edit-body {
  display: grid;
  gap: 14px;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

.plan-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid color-mix(in srgb, var(--cyan) 24%, var(--line));
  border-radius: 14px;
  padding: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 11%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 70%, transparent);
}

.plan-detail-head strong {
  color: var(--text);
  font-size: 18px;
}

.plan-detail-head div:first-child {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.plan-detail-head span,
.plan-edit-body p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.plan-status-strip,
.plan-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.plan-status-strip {
  justify-content: flex-end;
  max-width: 520px;
}

.plan-status-strip span,
.plan-chip-row span {
  border: 1px solid color-mix(in srgb, var(--cyan) 26%, var(--line));
  border-radius: 999px;
  padding: 5px 9px;
  color: color-mix(in srgb, var(--text) 82%, var(--cyan));
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  font-size: 12px;
  font-weight: 700;
}

.plan-snapshot-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.plan-snapshot-overview article {
  display: grid;
  gap: 5px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--cyan) 24%, var(--line));
  border-radius: 8px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 8%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface) 74%, transparent);
}

.plan-snapshot-overview span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.plan-snapshot-overview strong {
  overflow: hidden;
  color: var(--text);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-snapshot-overview em {
  overflow: hidden;
  color: color-mix(in srgb, var(--text) 70%, var(--cyan));
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-detail-section,
.plan-edit-section {
  display: grid;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 8px;
  padding: 16px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-strong) 58%, transparent);
}

.plan-detail-section > header,
.plan-edit-section > header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.plan-detail-section > header > span,
.plan-edit-section > header > span {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--cyan);
  background: color-mix(in srgb, var(--cyan) 8%, transparent);
  font-size: 12px;
  font-weight: 800;
}

.plan-detail-section > header strong,
.plan-edit-section > header strong {
  color: var(--text);
  font-size: 16px;
}

.plan-detail-section > header em,
.plan-edit-section > header em {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.plan-detail-item {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--line) 74%, transparent);
  border-radius: 8px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--surface) 76%, transparent);
}

.plan-detail-item.wide {
  grid-column: 1 / -1;
}

.plan-detail-item span,
.plan-json-grid span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.plan-detail-item strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.plan-object-grid,
.plan-json-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.plan-object-card {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, var(--line));
  border-radius: 8px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface) 76%, transparent);
}

.plan-object-card b,
.plan-case-list > b {
  color: color-mix(in srgb, var(--text) 86%, var(--cyan));
  font-size: 13px;
}

.plan-object-card dl {
  display: grid;
  grid-template-columns: minmax(86px, 0.26fr) minmax(0, 1fr);
  gap: 8px 10px;
  margin: 0;
}

.plan-object-card dt {
  color: var(--text-muted);
  font-size: 12px;
}

.plan-object-card dd {
  min-width: 0;
  margin: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.plan-case-list {
  display: grid;
  gap: 8px;
}

.plan-case-list article {
  display: grid;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  border-radius: 8px;
  padding: 10px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
}

.plan-case-list strong {
  color: var(--text);
  font-size: 13px;
}

.plan-case-list p {
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.plan-stage-list {
  display: grid;
  gap: 10px;
}

.plan-stage-card {
  display: grid;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--line));
  border-radius: 8px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 9%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface) 76%, transparent);
}

.plan-stage-card header {
  display: flex;
  align-items: center;
  gap: 9px;
}

.plan-stage-card header em {
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.plan-stage-card header strong {
  color: var(--text);
}

.plan-stage-goal {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  color: var(--text-soft);
  line-height: 1.65;
}

.plan-stage-goal svg {
  flex: 0 0 auto;
  margin-top: 3px;
  color: var(--primary);
}

.plan-score-list {
  max-height: none;
}

.plan-edit-note {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--green) 26%, var(--line));
  border-radius: 8px;
  padding: 12px;
  color: var(--text-soft);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--green) 9%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface) 76%, transparent);
  font-size: 13px;
  line-height: 1.65;
}

.plan-edit-note svg {
  color: var(--green);
}

.plan-edit-section .training-form-grid label.wide,
.plan-json-grid label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.plan-edit-section .training-form-grid label.wide {
  grid-column: 1 / -1;
}

.plan-edit-template-switch {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.plan-edit-template-switch button {
  border-radius: 8px;
}

.plan-edit-template-switch span {
  display: block;
}

.plan-edit-collapse {
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}

.plan-edit-collapse :deep(.el-collapse-item__header),
.plan-edit-collapse :deep(.el-collapse-item__wrap) {
  color: var(--text);
  background: transparent;
}

.plan-edit-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 14px;
}

.plan-json-grid :deep(.el-textarea__inner) {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.plan-edit-section :deep(.el-input-number) {
  width: 100%;
}

.tech-button.full {
  width: 100%;
  margin-top: 12px;
}

.setup-flow-content,
.role-goal-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-width: 0;
}

.setup-flow-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(154px, 1fr));
  gap: 10px;
}

.setup-step-card {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--line) 82%, transparent);
  border-radius: 16px;
  padding: 12px;
  color: var(--text-muted);
  text-align: left;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface) 74%, transparent);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.setup-step-card::after {
  display: none;
}

.setup-step-card:last-child::after {
  display: none;
}

.setup-step-card.active {
  border-color: color-mix(in srgb, var(--cyan) 72%, var(--primary));
  box-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 18%, transparent);
  transform: translateY(-1px);
}

.setup-step-card.active {
  color: var(--text);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 17%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 80%, transparent);
}

.setup-step-card.done svg {
  color: var(--green);
}

.setup-step-card.locked {
  opacity: 0.58;
}

.setup-step-card.locked {
  cursor: not-allowed;
}

.setup-step-card svg {
  border: 1px solid color-mix(in srgb, var(--cyan) 34%, var(--line));
  border-radius: 12px;
  padding: 7px;
  width: 34px;
  height: 34px;
  color: var(--cyan);
  background: color-mix(in srgb, var(--surface-strong) 78%, transparent);
}

.setup-step-card span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.setup-step-card strong {
  color: var(--text);
  font-size: 14px;
}

.setup-step-card em {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setup-flow-actions {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  border: 1px solid color-mix(in srgb, var(--cyan) 26%, var(--line));
  border-radius: 14px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 9%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface) 72%, transparent);
}

.setup-flow-actions > div:first-child {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.setup-flow-actions strong {
  color: var(--text);
  font-size: 14px;
}

.setup-flow-actions span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.setup-flow-actions .training-action-row {
  margin-top: 0;
}

.setup-flow-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.setup-flow-actions .tech-button.ghost {
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface) 68%, transparent);
}

.role-card {
  min-width: 0;
}

.goal-card {
  display: grid;
  align-content: start;
}

.stage-setting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: -18px -18px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  border-radius: 16px 16px 0 0;
  padding: 14px 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface-strong) 82%, transparent);
}

.stage-setting-head div {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.stage-setting-head svg {
  flex: 0 0 auto;
  color: var(--text);
}

.stage-setting-head strong {
  flex: 0 0 auto;
  color: var(--text);
  font-size: 18px;
}

.stage-setting-head span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-setting-head em,
.open-stage-card header em {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--cyan) 36%, var(--line));
  border-radius: 999px;
  padding: 6px 12px;
  color: color-mix(in srgb, var(--text) 84%, var(--cyan));
  background: color-mix(in srgb, var(--cyan) 10%, var(--surface));
  font-size: 13px;
  font-style: normal;
  font-weight: 800;
}

.open-stage-card {
  display: grid;
  gap: 18px;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, var(--line));
  border-radius: 16px;
  padding: 26px 36px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--cyan) 5%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface) 86%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent);
}

.open-stage-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.open-stage-card header div {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.open-stage-card header span {
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
}

.open-stage-card h3 {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  line-height: 1.35;
}

.open-stage-goal {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--text);
  font-size: 16px;
  line-height: 1.75;
}

.open-stage-goal svg {
  flex: 0 0 auto;
  margin-top: 5px;
  color: #f472b6;
}

.open-stage-goal b {
  flex: 0 0 auto;
}

.stage-condition-list {
  display: grid;
  gap: 26px;
}

.stage-condition-list section {
  display: grid;
  gap: 12px;
}

.stage-condition-list b {
  color: var(--text);
  font-size: 17px;
  font-weight: 800;
}

.stage-condition-list ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 26px;
  color: var(--text-soft);
  font-size: 15px;
  line-height: 1.75;
}

.stage-condition-list li::marker {
  color: var(--text);
  font-weight: 800;
}

.condition-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.role-profile-hero,
.profile-section,
.goal-core,
.condition-grid div,
.retrieval-strip {
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
}

.role-profile-hero {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
  padding: 13px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface) 78%, transparent);
}

.role-profile-hero div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.role-profile-hero span,
.profile-field-block span {
  color: var(--text-muted);
  font-size: 12px;
}

.role-profile-hero strong {
  color: var(--primary);
  font-size: 18px;
}

.role-profile-hero p {
  margin: 0;
  color: var(--text);
  line-height: 1.55;
}

.role-confirm-view {
  display: grid;
  gap: 18px;
}

.role-confirm-view header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 10px;
}

.role-confirm-view header div {
  display: grid;
  gap: 8px;
}

.role-confirm-view header strong {
  color: var(--text);
  font-size: 22px;
}

.role-confirm-view header span {
  color: var(--text-muted);
  font-size: 14px;
}

.role-confirm-card {
  display: grid;
  gap: 8px;
  border-left: 4px solid var(--primary);
  border-radius: 14px;
  padding: 16px 18px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
}

.role-confirm-card.blue {
  border-left-color: var(--primary);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 13%, transparent), transparent 54%),
    color-mix(in srgb, var(--surface) 76%, transparent);
}

.role-confirm-card.amber {
  border-left-color: #f6b73c;
  background:
    linear-gradient(135deg, color-mix(in srgb, #f6b73c 14%, transparent), transparent 54%),
    color-mix(in srgb, var(--surface) 76%, transparent);
}

.role-confirm-card b,
.role-confirm-section b {
  color: var(--primary);
  font-size: 16px;
}

.role-confirm-card.amber b {
  color: #d3830c;
}

.role-confirm-card p,
.role-confirm-section p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.75;
}

.role-confirm-section {
  display: grid;
  gap: 7px;
  padding: 2px 4px;
}

.profile-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  min-width: 0;
}

.profile-section {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 12px;
  min-width: 0;
}

.profile-section.coach-only {
  border-color: color-mix(in srgb, var(--primary) 42%, var(--line));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent 38%),
    color-mix(in srgb, var(--surface) 72%, transparent);
}

.profile-section b {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--primary);
  font-size: 13px;
}

.profile-section dl {
  display: grid;
  grid-template-columns: minmax(82px, 0.22fr) minmax(0, 1fr);
  gap: 7px 10px;
  margin: 0;
}

.profile-section dt {
  color: var(--text-muted);
  font-size: 12px;
}

.profile-section dd {
  min-width: 0;
  margin: 0;
  color: var(--text);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: normal;
  overflow-wrap: anywhere;
}

.profile-field-block {
  display: grid;
  gap: 6px;
  border-left: 2px solid color-mix(in srgb, var(--primary) 55%, transparent);
  padding-left: 10px;
}

.profile-field-block p {
  position: relative;
  margin: 0;
  padding-left: 13px;
  color: var(--text-soft);
  line-height: 1.6;
  word-break: break-word;
}

.profile-field-block p::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.72em;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--primary);
  box-shadow: 0 0 10px color-mix(in srgb, var(--primary) 65%, transparent);
}

.profile-field-block.compact p {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  border-radius: 999px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--surface-strong) 68%, transparent);
}

.profile-field-block.compact p::before {
  display: none;
}

.condition-grid b {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.condition-grid p,
.training-bubble p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.65;
}

.goal-core {
  display: grid;
  gap: 6px;
  padding: 12px;
}

.goal-core span {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.goal-core strong {
  font-size: 16px;
  line-height: 1.55;
}

.condition-grid {
  margin-top: 10px;
}

.condition-grid div {
  display: grid;
  gap: 7px;
  padding: 10px;
}

.session-start-bar {
  justify-content: space-between;
  margin-top: 12px;
}

.score-rule-panel {
  border-color: color-mix(in srgb, var(--green) 24%, var(--line));
}

.score-rule-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.score-rule-summary strong,
.score-rule-summary span {
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 12px;
  padding: 9px 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--green) 8%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface) 74%, transparent);
}

.score-rule-summary strong {
  color: var(--text);
  font-size: 13px;
}

.score-rule-summary span {
  color: var(--text-muted);
  font-size: 12px;
}

.score-rule-list {
  display: grid;
  gap: 9px;
  max-height: 520px;
  overflow-y: auto;
}

.score-rule-card {
  display: grid;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 14px;
  padding: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 8%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface) 76%, transparent);
}

.score-rule-card.stage {
  border-color: color-mix(in srgb, var(--primary) 36%, var(--line));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface) 78%, transparent);
}

.score-rule-card b {
  color: var(--primary);
  font-size: 13px;
}

.score-rule-card p {
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.55;
}

.training-chat-workspace {
  display: grid;
  grid-template-columns: minmax(250px, 320px) minmax(0, 1fr) minmax(280px, 360px);
  gap: 14px;
  align-items: stretch;
  min-height: calc(100vh - 280px);
}

.training-chat-side,
.training-coach-side {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
}

.training-chat-shell.focused {
  min-height: calc(100vh - 280px);
  height: calc(100vh - 280px);
}

.chat-role-card {
  display: grid;
  gap: 10px;
}

.chat-role-card strong {
  color: var(--primary);
  font-size: 18px;
}

.chat-role-card p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.chat-role-card dl {
  display: grid;
  grid-template-columns: minmax(72px, 0.35fr) minmax(0, 1fr);
  gap: 7px 10px;
  margin: 0;
}

.chat-role-card dt {
  color: var(--text-muted);
  font-size: 12px;
}

.chat-role-card dd {
  min-width: 0;
  margin: 0;
  color: var(--text);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.coach-analysis-inline {
  display: grid;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--green) 28%, var(--line));
  border-radius: 12px;
  margin-top: 9px;
  padding: 8px 9px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--green) 10%, transparent), transparent 44%),
    color-mix(in srgb, var(--surface-strong) 72%, transparent);
}

.coach-analysis-inline b {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--green);
  font-size: 12px;
}

.coach-analysis-inline span {
  width: fit-content;
  max-width: 100%;
  border: 1px solid color-mix(in srgb, var(--green) 24%, var(--line));
  border-radius: 999px;
  padding: 3px 8px;
  color: var(--text-muted);
  font-size: 12px;
  background: color-mix(in srgb, var(--green) 7%, transparent);
}

.coach-analysis-card {
  display: grid;
  gap: 8px;
}

.coach-analysis-card strong {
  border: 1px solid color-mix(in srgb, var(--green) 30%, var(--line));
  border-radius: 14px;
  padding: 10px;
  color: var(--text);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--green) 12%, transparent), transparent 44%),
    color-mix(in srgb, var(--surface) 76%, transparent);
  line-height: 1.55;
}

.coach-analysis-card b {
  color: var(--primary);
  font-size: 13px;
}

.coach-analysis-card p {
  margin: 0;
  border-left: 2px solid color-mix(in srgb, var(--primary) 55%, transparent);
  padding-left: 9px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.coach-analysis-card em {
  border: 1px solid color-mix(in srgb, var(--cyan) 28%, var(--line));
  border-radius: 12px;
  padding: 8px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--cyan) 7%, transparent);
  font-size: 12px;
  font-style: normal;
  line-height: 1.55;
}

.training-chat-shell {
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr) auto;
  min-height: 580px;
}

.training-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--line);
}

.training-chat-header > div:first-child {
  display: grid;
  gap: 5px;
}

.training-chat-header span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.training-chat-metrics {
  display: grid;
  grid-template-columns: auto auto minmax(120px, 180px);
  gap: 8px;
  align-items: center;
}

.training-chat-metrics em,
.panel-title-between em {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: color-mix(in srgb, var(--text) 72%, var(--cyan));
  background: color-mix(in srgb, var(--cyan) 9%, transparent);
  font-size: 12px;
  font-style: normal;
}

.training-message-window {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  background:
    linear-gradient(90deg, transparent 0 31px, color-mix(in srgb, var(--cyan) 7%, transparent) 32px),
    linear-gradient(0deg, transparent 0 31px, color-mix(in srgb, var(--primary) 6%, transparent) 32px);
  background-size: 32px 32px;
}

.training-message {
  display: grid;
  grid-template-columns: 34px minmax(0, 78%);
  gap: 10px;
  align-items: start;
}

.training-message.trainee {
  grid-template-columns: minmax(0, 78%) 34px;
  justify-content: end;
}

.training-message.trainee .training-avatar {
  grid-column: 2;
}

.training-message.trainee .training-bubble {
  grid-column: 1;
  grid-row: 1;
  border-color: color-mix(in srgb, var(--primary) 34%, var(--line));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), transparent 50%),
    color-mix(in srgb, var(--surface) 74%, transparent);
}

.training-message.system {
  grid-template-columns: 34px minmax(0, 1fr);
}

.training-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--cyan) 34%, var(--line));
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--cyan));
  box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 28%, transparent);
  font-size: 12px;
  font-weight: 700;
}

.training-bubble {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  border-radius: 16px;
  padding: 11px 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 10%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface) 78%, transparent);
  box-shadow: var(--shadow-sm);
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.message-meta b {
  color: var(--text);
}

.message-meta em {
  font-style: normal;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

.training-composer {
  display: grid;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding: 12px;
}

.retrieval-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  color: var(--text-muted);
  font-size: 12px;
}

.retrieval-strip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.composer-actions {
  flex-direction: column;
  align-items: stretch;
}

.training-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 160px;
  color: var(--text-muted);
  text-align: center;
}

.training-empty.compact {
  min-height: 110px;
}

.training-empty.in-chat {
  align-self: center;
  min-height: 260px;
}

:deep(.training-mode-switch .el-radio-button__inner),
:deep(.training-form-grid .el-input__wrapper),
:deep(.training-form-grid .el-select__wrapper),
:deep(.training-field .el-input__wrapper),
:deep(.training-field .el-textarea__inner),
:deep(.training-composer .el-textarea__inner) {
  border-color: color-mix(in srgb, var(--line) 88%, transparent);
  color: var(--text);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  box-shadow: none;
}

:deep(.training-mode-switch .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  border-color: color-mix(in srgb, var(--cyan) 70%, var(--primary));
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--cyan));
  box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 34%, transparent);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1320px) {
  .training-console-layout {
    grid-template-columns: 1fr;
  }

  .training-workspace-rail {
    position: static;
    grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
    align-items: start;
  }

  .training-workspace-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .training-workspace {
    grid-template-columns: 1fr;
  }

  .training-left-panel {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .training-chat-workspace {
    grid-template-columns: 1fr;
  }

  .training-chat-shell.focused {
    height: auto;
    min-height: 720px;
  }

  .training-right-panel {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .training-right-panel .customer-profile-panel {
    grid-column: 1 / -1;
  }

  .training-right-panel .profile-dynamic-grid {
    max-height: 320px;
  }
}

@media (max-width: 1080px) {
  .training-console-layout,
  .training-workspace,
  .role-goal-grid,
  .setup-flow-tabs,
  .training-right-panel {
    grid-template-columns: 1fr;
  }

  .setup-step-card::after {
    display: none;
  }

  .setup-flow-actions {
    grid-template-columns: 1fr;
  }

  .setup-flow-actions .training-action-row {
    justify-content: flex-start;
  }

  .stage-setting-head,
  .stage-setting-head div,
  .open-stage-card header,
  .open-stage-goal,
  .plan-detail-head,
  .plan-stage-card header {
    align-items: flex-start;
    flex-direction: column;
  }

  .stage-setting-head span {
    white-space: normal;
  }

  .plan-status-strip {
    justify-content: flex-start;
    max-width: none;
  }

  .training-left-panel .training-form-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .training-workspace-rail,
  .training-workspace-nav,
  .training-workspace.plan-step-workspace,
  .training-form-grid.two,
  .training-form-grid.four,
  .training-left-panel .training-form-grid.two,
  .profile-template-switch,
  .training-right-panel .profile-template-switch,
  .plan-edit-template-switch,
  .profile-dynamic-grid,
  .training-right-panel .profile-dynamic-grid,
  .profile-section-grid,
  .plan-snapshot-overview,
  .plan-detail-grid,
  .plan-object-grid,
  .plan-json-grid,
  .condition-grid,
  .composer-row,
  .training-chat-metrics {
    grid-template-columns: 1fr;
  }

  .training-workspace-nav button {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .training-workspace-nav button b,
  .training-workspace-nav button small {
    grid-column: 2;
  }

  .role-profile-hero div {
    align-items: flex-start;
    flex-direction: column;
  }

  .open-stage-card {
    padding: 18px;
  }

  .open-stage-card h3 {
    font-size: 20px;
  }

  .stage-condition-list ol {
    padding-left: 22px;
  }

  .training-message,
  .training-message.trainee {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .training-message.trainee .training-avatar {
    grid-column: 1;
  }

  .training-message.trainee .training-bubble {
    grid-column: 2;
  }
}
</style>
