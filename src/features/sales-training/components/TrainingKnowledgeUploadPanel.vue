<script setup lang="ts">
// 训练资料上传面板：只承载上传预览 UI，具体上传、发布、重切动作交给父组件处理。
import { computed } from 'vue'
import { AlertTriangle, BadgeCheck, CircleHelp, FileCheck2, Sparkles, UploadCloud } from 'lucide-vue-next'
import type { TrainingKnowledgeUploadResponse } from '../types'
import { displayValue } from '../composables/trainingDisplay'
import {
  trainingKnowledgeFlowSummary,
  trainingKnowledgeQualityMetricItems,
  trainingKnowledgeQualitySummary,
  trainingKnowledgeQualityWarnings,
} from '../composables/trainingKnowledgeDisplay'
import {
  canRetryTrainingIngestTask,
  canPublishTrainingKnowledgeBatch,
  canReparseTrainingKnowledgeBatch,
  isTrainingIngestProcessing,
  trainingIngestProgress,
  trainingIngestStepLabel,
} from '../composables/trainingIngestTask'

const props = defineProps<{
  selectedFile: File | null
  uploadResult: TrainingKnowledgeUploadResponse | null
  uploading: boolean
  uploadHelpDescription: string
  currentUploadChunkCount: number
  currentUploadPointCount: number
  currentUploadStatus: string
  currentUploadDuplicateText: string
  canClearUploadArea: boolean
  uploadQualityReport: Record<string, unknown>
  uploadQualityWarnings: string[]
  uploadQualityMetrics: Record<string, unknown>
  uploadQualitySplitText: string
  uploadPublishValidation: Record<string, unknown> | null
  publishingBatchId: string
  reparsingBatchId: string
  retryingTaskId: string
  qualityLevelLabel: (level: unknown) => string
  qualityLevelClass: (level: unknown) => string
}>()

const emit = defineEmits<{
  fileChange: [file: File | undefined]
  clearUpload: []
  upload: []
  publishBatch: [batchId: string]
  reparseBatch: [batchId: string]
  retryTask: [batchId: string]
}>()

const uploadFlowSummary = computed(() => trainingKnowledgeFlowSummary(props.uploadResult))
const uploadQualitySummary = computed(() => trainingKnowledgeQualitySummary(props.uploadQualityReport))

const uploadPanelStatus = computed(() => {
  // 面板右上角只展示一个当前状态，避免上传完成后重复出现多处状态文案。
  if (props.uploading) return '上传中'
  if (props.uploadResult) return props.currentUploadStatus
  if (props.selectedFile) return '待上传'
  return '未选择'
})

const uploadResultTone = computed(() => {
  // 根据上传结果生成视觉状态，用于区分成功、处理中、失败和重复资料。
  const result = props.uploadResult
  if (!result) return 'idle'
  if (result.duplicate_of) return 'duplicated'
  if (result.task_status === 'failed' || String(result.status || '').endsWith('_failed')) return 'failed'
  if (isTrainingIngestProcessing(result)) return 'processing'
  if (result.status === 'published') return 'published'
  return 'pending'
})

const uploadResultTitle = computed(() => {
  // 上传结果标题保持短句，详细批次号放到副标题和标签里。
  const result = props.uploadResult
  if (!result) return props.selectedFile ? '文件已选择，等待上传' : '选择资料后开始处理'
  if (result.duplicate_of) return '资料已存在，复用历史批次'
  if (isTrainingIngestProcessing(result)) return '资料已保存，后台处理中'
  if (canRetryTrainingIngestTask(result)) return '入库任务失败，需要处理'
  if (result.status === 'published') return '资料已发布并参与训练'
  return '切片已生成，等待确认发布'
})

const uploadResultSubtitle = computed(() => {
  // 副标题只保留文件名和批次关键信息，避免左侧面板出现长段调试信息。
  const result = props.uploadResult
  if (!result) return props.selectedFile?.name || '支持 DOCX、PDF、TXT 格式'
  const fileName = result.source_file || props.selectedFile?.name || '训练资料'
  return `${fileName} · 批次 ${result.batch_id}`
})

const uploadQualityTags = computed(() => {
  // 质量标签只保留用户判断发布需要的字段，避免左侧变成技术报告。
  const tags = [
    `切片 ${displayValue(props.uploadQualityMetrics.chunk_count ?? props.currentUploadChunkCount)}`,
    props.uploadQualitySplitText,
  ]

  if (uploadQualitySummary.value.warningCount > 0) {
    tags.push(`告警 ${uploadQualitySummary.value.warningCount} 条`)
  }

  return tags.filter(Boolean)
})

const visibleUploadQualityWarnings = computed(() => trainingKnowledgeQualityWarnings(props.uploadQualityReport))
const uploadQualityMetricItems = computed(() => trainingKnowledgeQualityMetricItems(props.uploadQualityReport))

const uploadStatText = computed(() => {
  // 上传结果只保留切片数和重复校验，向量点属于技术细节，不放在主面板里。
  if (!props.uploadResult) return '上传后生成切片和质量评分'
  return `${props.currentUploadChunkCount} 切片 · ${props.currentUploadDuplicateText}`
})

function onFileInputChange(event: Event) {
  // 文件 input 只把 File 对象交给上层，面板不直接访问后端接口。
  const input = event.target as HTMLInputElement
  emit('fileChange', input.files?.[0])
}
</script>

<template>
  <section class="training-panel training-upload-panel">
    <div class="panel-title panel-title-between">
      <span class="panel-title-with-help">
        <UploadCloud :size="16" />
        训练资料上传
        <el-tooltip :content="uploadHelpDescription" placement="top" effect="dark">
          <CircleHelp :size="13" />
        </el-tooltip>
      </span>
      <span class="panel-title-actions">
        <em>{{ uploadPanelStatus }}</em>
        <el-button v-if="canClearUploadArea" text size="small" @click="emit('clearUpload')">清空</el-button>
      </span>
    </div>

    <div class="upload-command-card">
      <label class="training-upload-zone">
        <input type="file" accept=".docx,.pdf,.txt" @change="onFileInputChange" />
        <span class="upload-zone-icon"><UploadCloud :size="24" /></span>
        <span class="upload-zone-text">
          <strong>{{ selectedFile?.name || '选择训练资料文件' }}</strong>
          <small>DOCX / PDF / TXT，上传后先生成待发布切片</small>
        </span>
      </label>
      <el-button
        class="tech-button primary full"
        :icon="UploadCloud"
        :loading="uploading"
        :disabled="!selectedFile || uploading"
        @click="emit('upload')"
      >
        上传并分析
      </el-button>
    </div>

    <div v-if="uploadResult" class="upload-result-card" :class="uploadResultTone">
      <component
        :is="uploadResultTone === 'failed' ? AlertTriangle : uploadResult ? BadgeCheck : FileCheck2"
        :size="18"
      />
      <div>
        <strong>{{ uploadResultTitle }}</strong>
        <span>{{ uploadResultSubtitle }}</span>
        <small>{{ uploadStatText }}</small>
      </div>
    </div>

    <div v-if="uploadResult && isTrainingIngestProcessing(uploadResult)" class="training-task-progress">
      <div>
        <strong>{{ trainingIngestStepLabel(uploadResult) }}</strong>
        <span>{{ trainingIngestProgress(uploadResult) }}%</span>
      </div>
      <el-progress :percentage="trainingIngestProgress(uploadResult)" :stroke-width="8" />
    </div>

    <div v-else-if="uploadResult && canRetryTrainingIngestTask(uploadResult)" class="training-task-progress failed">
      <div>
        <strong>{{ uploadResult.error_message || '入库任务失败' }}</strong>
        <span>任务 {{ uploadResult.task_id || '未记录' }}</span>
      </div>
      <el-progress :percentage="trainingIngestProgress(uploadResult)" status="exception" :stroke-width="8" />
      <el-button
        class="tech-button full"
        :icon="Sparkles"
        :loading="retryingTaskId === uploadResult.task_id"
        @click="emit('retryTask', uploadResult.batch_id)"
      >
        重试入库
      </el-button>
    </div>

    <div v-if="uploadResult" class="training-flow-card compact">
      <div class="training-flow-head">
        <strong>处理进度</strong>
        <span>{{ uploadFlowSummary }}</span>
      </div>
      <el-progress
        v-if="isTrainingIngestProcessing(uploadResult)"
        :percentage="trainingIngestProgress(uploadResult)"
        :stroke-width="7"
      />
    </div>

    <div
      v-if="uploadResult && !uploadResult.duplicate_of"
      class="training-quality-card"
      :class="qualityLevelClass(uploadQualityReport.level)"
    >
      <header>
        <span>文档上传得分</span>
        <strong>{{ uploadQualitySummary.scoreText }}</strong>
      </header>
      <p>
        {{ uploadQualityReport.score === undefined ? uploadQualitySummary.levelText : qualityLevelLabel(uploadQualityReport.level) }}
        · {{ uploadQualitySummary.detailText }}
      </p>
      <div class="quality-tag-row">
        <span v-for="tag in uploadQualityTags" :key="tag">{{ tag }}</span>
      </div>
      <div v-if="uploadPublishValidation" class="quality-validation-row">
        <strong>{{ uploadPublishValidation.passed ? '发布验证通过' : '发布验证需检查' }}</strong>
        <span>
          {{ uploadPublishValidation.summary }}
          · 命中率 {{ displayValue(uploadPublishValidation.hit_ratio ?? 0) }}
        </span>
      </div>
      <div v-if="uploadQualityMetricItems.length" class="quality-metric-grid">
        <span v-for="item in uploadQualityMetricItems" :key="item.label">
          <em>{{ item.label }}</em>
          <strong>{{ item.value }}</strong>
        </span>
      </div>
      <ul v-if="visibleUploadQualityWarnings.length" class="quality-warning-list">
        <li v-for="warning in visibleUploadQualityWarnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>

    <div v-if="uploadResult && !uploadResult.duplicate_of" class="training-upload-publish-actions">
      <el-button
        v-if="canPublishTrainingKnowledgeBatch(uploadResult)"
        class="tech-button primary"
        :loading="publishingBatchId === uploadResult.batch_id"
        @click="emit('publishBatch', uploadResult.batch_id)"
      >
        确认发布
      </el-button>
      <el-button
        v-if="canReparseTrainingKnowledgeBatch(uploadResult)"
        class="tech-button"
        :icon="Sparkles"
        :loading="reparsingBatchId === uploadResult.batch_id"
        @click="emit('reparseBatch', uploadResult.batch_id)"
      >
        LLM 重切
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.training-panel {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 78%, var(--cyan) 18%);
  border-radius: 14px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 95%, transparent), color-mix(in srgb, var(--surface-2) 88%, transparent));
  box-shadow: var(--shadow-sm);
}

.training-panel::before {
  position: absolute;
  top: 0;
  right: 14px;
  left: 14px;
  height: 2px;
  content: '';
  background: linear-gradient(90deg, transparent, var(--cyan), var(--primary), transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 54%, transparent);
}

.training-upload-panel {
  display: grid;
  align-content: start;
  gap: 10px;
}

.training-upload-panel .panel-title-between {
  align-items: flex-start;
  gap: 8px;
}

.panel-title-with-help {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
  line-height: 1.45;
}

.panel-title-with-help svg:last-child {
  color: color-mix(in srgb, var(--cyan) 78%, var(--text-muted));
  cursor: help;
}

.panel-title-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.panel-title-actions em {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: color-mix(in srgb, var(--text) 72%, var(--cyan));
  background: color-mix(in srgb, var(--cyan) 9%, transparent);
  font-size: 12px;
  font-style: normal;
}

.panel-title-actions .el-button {
  height: 26px;
  padding: 0 6px;
  color: color-mix(in srgb, var(--cyan) 78%, var(--text));
}

.upload-command-card {
  display: grid;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, var(--line));
  border-radius: 12px;
  padding: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 70%, transparent);
}

.training-upload-zone {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 66px;
  border: 1px dashed color-mix(in srgb, var(--cyan) 42%, var(--line));
  border-radius: 10px;
  padding: 10px;
  color: var(--text);
  background:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--cyan) 8%, transparent) 0 1px, transparent 1px 32px),
    color-mix(in srgb, var(--surface) 68%, transparent);
  cursor: pointer;
}

.training-upload-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-zone-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, var(--line));
  border-radius: 10px;
  color: var(--cyan);
  background: color-mix(in srgb, var(--cyan) 10%, transparent);
}

.upload-zone-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.upload-zone-text strong,
.upload-zone-text small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-zone-text small {
  color: var(--text-muted);
  font-size: 12px;
}

.tech-button.full {
  width: 100%;
}

.upload-result-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  border: 1px solid color-mix(in srgb, var(--line) 74%, transparent);
  border-radius: 12px;
  padding: 10px;
  color: var(--text);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}

.upload-result-card svg {
  margin-top: 2px;
  color: var(--text-muted);
}

.upload-result-card.processing,
.upload-result-card.pending {
  border-color: color-mix(in srgb, var(--cyan) 36%, var(--line));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 10%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 76%, transparent);
}

.upload-result-card.published {
  border-color: color-mix(in srgb, #31d0aa 40%, var(--line));
}

.upload-result-card.duplicated {
  border-color: color-mix(in srgb, #f6c65b 44%, var(--line));
}

.upload-result-card.failed {
  border-color: color-mix(in srgb, #ff6b7a 46%, var(--line));
}

.upload-result-card.processing svg,
.upload-result-card.pending svg {
  color: var(--cyan);
}

.upload-result-card.published svg {
  color: #31d0aa;
}

.upload-result-card.duplicated svg {
  color: #f6c65b;
}

.upload-result-card.failed svg {
  color: #ff6b7a;
}

.upload-result-card div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.upload-result-card strong,
.upload-result-card span,
.upload-result-card small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-result-card strong {
  font-size: 14px;
}

.upload-result-card span,
.upload-result-card small {
  color: var(--text-muted);
  font-size: 12px;
}

.training-task-progress {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--cyan) 28%, var(--line));
  border-radius: 12px;
  padding: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 9%, transparent), transparent 54%),
    color-mix(in srgb, var(--surface-strong) 76%, transparent);
}

.training-task-progress.failed {
  border-color: color-mix(in srgb, #ff6b7a 38%, var(--line));
}

.training-task-progress > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.training-task-progress strong,
.training-task-progress span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-task-progress strong {
  color: var(--text);
  font-size: 13px;
}

.training-task-progress span {
  color: var(--text-muted);
  font-size: 11px;
}

.training-flow-card {
  display: grid;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--cyan) 20%, var(--line));
  border-radius: 12px;
  padding: 9px 10px;
  background: color-mix(in srgb, var(--surface-strong) 70%, transparent);
}

.training-flow-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.training-flow-head strong,
.training-flow-head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-flow-head strong {
  color: var(--text);
  font-size: 13px;
}

.training-flow-head span {
  color: var(--text-muted);
  font-size: 12px;
}

.training-quality-card {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--cyan) 28%, var(--line));
  border-radius: 12px;
  padding: 11px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 8%, transparent), transparent 54%),
    color-mix(in srgb, var(--surface-strong) 78%, transparent);
}

.training-quality-card.good {
  border-color: color-mix(in srgb, #31d0aa 42%, var(--line));
}

.training-quality-card.review {
  border-color: color-mix(in srgb, #f6c65b 46%, var(--line));
}

.training-quality-card.poor {
  border-color: color-mix(in srgb, #ff6b7a 46%, var(--line));
}

.training-quality-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.training-quality-card header span {
  color: color-mix(in srgb, var(--text) 78%, var(--cyan));
  font-size: 12px;
  font-weight: 800;
}

.training-quality-card header strong {
  color: var(--primary);
  font-size: 20px;
  line-height: 1.2;
  white-space: nowrap;
}

.training-quality-card p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.quality-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quality-tag-row span,
.quality-validation-row span {
  border: 1px solid color-mix(in srgb, var(--cyan) 20%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface) 68%, transparent);
  font-size: 11px;
  line-height: 1.25;
}

.quality-validation-row {
  display: grid;
  gap: 5px;
}

.quality-validation-row strong {
  color: var(--text);
  font-size: 13px;
}

.quality-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.quality-metric-grid span {
  display: grid;
  gap: 3px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, var(--line));
  border-radius: 10px;
  padding: 6px 8px;
  background: color-mix(in srgb, var(--surface) 58%, transparent);
}

.quality-metric-grid em,
.quality-metric-grid strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quality-metric-grid em {
  color: var(--text-muted);
  font-size: 11px;
  font-style: normal;
}

.quality-metric-grid strong {
  color: var(--text);
  font-size: 12px;
}

.training-quality-card ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 16px;
}

.training-quality-card li {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.quality-warning-list {
  max-height: 118px;
  overflow: auto;
}

.training-upload-publish-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.training-upload-publish-actions .el-button {
  margin-left: 0;
}
</style>
