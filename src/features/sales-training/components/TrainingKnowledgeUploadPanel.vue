<script setup lang="ts">
// 训练资料上传面板：只承载上传预览 UI，具体上传、发布、重切动作交给父组件处理。
import { BadgeCheck, CircleHelp, Sparkles, UploadCloud } from 'lucide-vue-next'
import type { TrainingKnowledgeUploadResponse } from '../types'
import { displayValue } from '../composables/trainingDisplay'

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
  qualityLevelLabel: (level: unknown) => string
  qualityLevelClass: (level: unknown) => string
}>()

const emit = defineEmits<{
  fileChange: [file: File | undefined]
  clearUpload: []
  upload: []
  publishBatch: [batchId: string]
  reparseBatch: [batchId: string]
}>()

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
        <em>{{ currentUploadStatus }}</em>
        <el-button v-if="canClearUploadArea" text size="small" @click="emit('clearUpload')">清空上传区域</el-button>
      </span>
    </div>
    <div class="training-upload-zone">
      <input type="file" accept=".docx,.pdf,.txt" @change="onFileInputChange" />
      <UploadCloud :size="30" />
      <strong>{{ selectedFile?.name || '选择 LMS 案例文件' }}</strong>
      <span>先生成待发布切片和质量报告，确认后写入 sales_training_cases。</span>
    </div>
    <el-button class="tech-button primary full" :icon="UploadCloud" :loading="uploading" @click="emit('upload')">
      上传并生成切片
    </el-button>
    <div v-if="uploadResult" class="training-upload-feedback">
      <div class="training-upload-result" :class="{ duplicated: Boolean(uploadResult.duplicate_of) }">
        <BadgeCheck :size="16" />
        <div>
          <strong>{{ uploadResult.duplicate_of ? '资料已存在，已复用历史批次' : uploadResult.status === 'published' ? '资料已发布并完成入库' : '资料已保存，等待确认发布' }}</strong>
          <span>{{ uploadResult.source_file || '训练资料' }} · {{ uploadResult.chunk_count }} 切片 · 批次 {{ uploadResult.batch_id }}</span>
        </div>
      </div>
      <div class="training-kpi-grid knowledge">
        <div><strong>{{ currentUploadChunkCount }}</strong><span>切片数量</span></div>
        <div><strong>{{ currentUploadPointCount }}</strong><span>向量点</span></div>
        <div><strong>{{ currentUploadStatus }}</strong><span>入库状态</span></div>
        <div><strong>{{ currentUploadDuplicateText }}</strong><span>重复校验</span></div>
      </div>
      <div v-if="!uploadResult.duplicate_of && uploadQualityReport.score !== undefined" class="training-quality-card" :class="qualityLevelClass(uploadQualityReport.level)">
        <div>
          <strong>{{ uploadQualityReport.score }} 分</strong>
          <span>{{ qualityLevelLabel(uploadQualityReport.level) }} · {{ uploadQualityReport.summary }}</span>
        </div>
        <div class="quality-metric-row">
          <span>案例 {{ displayValue(uploadQualityMetrics.case_count ?? 0) }}</span>
          <span>切片 {{ displayValue(uploadQualityMetrics.chunk_count ?? 0) }}</span>
          <span>最大 {{ displayValue(uploadQualityMetrics.max_chunk_chars ?? 0) }} 字</span>
        </div>
        <div class="quality-metric-row">
          <span>{{ uploadQualitySplitText }}</span>
          <span v-if="uploadQualityReport.llm_fallback_attempted">
            规则 {{ displayValue(uploadQualityReport.rule_score ?? '-') }} 分
          </span>
          <span v-if="uploadQualityReport.llm_score !== undefined">
            LLM {{ displayValue(uploadQualityReport.llm_score) }} 分
          </span>
        </div>
        <div v-if="uploadPublishValidation" class="quality-validation-row">
          <strong>{{ uploadPublishValidation.passed ? '发布验证通过' : '发布验证需检查' }}</strong>
          <span>
            {{ uploadPublishValidation.summary }}
            命中率 {{ displayValue(uploadPublishValidation.hit_ratio ?? 0) }}
          </span>
        </div>
        <ul v-if="uploadQualityWarnings.length">
          <li v-for="warning in uploadQualityWarnings" :key="warning">{{ warning }}</li>
        </ul>
        <el-button
          v-if="uploadResult.status === 'pending_review' || uploadResult.status === 'publish_failed'"
          class="tech-button primary full"
          :loading="publishingBatchId === uploadResult.batch_id"
          @click="emit('publishBatch', uploadResult.batch_id)"
        >
          确认发布到训练库
        </el-button>
        <el-button
          v-if="uploadResult.status === 'pending_review'"
          class="tech-button full"
          :icon="Sparkles"
          :loading="reparsingBatchId === uploadResult.batch_id"
          @click="emit('reparseBatch', uploadResult.batch_id)"
        >
          LLM 重新切分
        </el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.training-panel {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 78%, var(--cyan) 18%);
  border-radius: 18px;
  padding: 13px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 7%, transparent), transparent 42%),
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
  box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 60%, transparent);
}

.training-upload-panel {
  display: grid;
  gap: 12px;
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
  gap: 8px;
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
  padding: 0 8px;
  color: color-mix(in srgb, var(--cyan) 78%, var(--text));
}

.training-upload-zone {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 7px;
  border: 1px dashed color-mix(in srgb, var(--cyan) 42%, var(--line));
  border-radius: 16px;
  padding: 16px 12px;
  color: var(--text);
  text-align: center;
  background:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--cyan) 10%, transparent) 0 1px, transparent 1px 34px),
    color-mix(in srgb, var(--surface) 68%, transparent);
}

.training-upload-zone strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-upload-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.training-upload-zone span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.tech-button.full {
  width: 100%;
}

.training-upload-feedback {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.training-upload-result {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 9px;
  align-items: start;
  margin-top: 12px;
  border: 1px solid color-mix(in srgb, var(--cyan) 32%, var(--line));
  border-radius: 14px;
  padding: 10px;
  color: var(--text);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 11%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 78%, transparent);
}

.training-upload-result svg {
  margin-top: 2px;
  color: var(--cyan);
}

.training-upload-result div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.training-upload-result strong,
.training-upload-result span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-upload-result span {
  color: var(--text-muted);
  font-size: 12px;
}

.training-upload-result.duplicated {
  border-color: color-mix(in srgb, #f6c65b 46%, var(--line));
  background:
    linear-gradient(135deg, color-mix(in srgb, #f6c65b 11%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 78%, transparent);
}

.training-upload-result.duplicated svg {
  color: #f6c65b;
}

.training-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.training-kpi-grid div {
  display: grid;
  gap: 3px;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 9px;
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}

.training-kpi-grid strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 17px;
  line-height: 1.25;
}

.training-kpi-grid span {
  color: var(--text-muted);
  font-size: 11px;
}

.training-quality-card {
  display: grid;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, var(--line));
  border-radius: 14px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 9%, transparent), transparent 54%),
    color-mix(in srgb, var(--surface-strong) 82%, transparent);
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

.training-quality-card > div:first-child {
  display: grid;
  gap: 4px;
}

.training-quality-card strong {
  color: var(--primary);
  font-size: 20px;
}

.training-quality-card span,
.training-quality-card li {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.quality-metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quality-metric-row span,
.quality-validation-row span {
  border: 1px solid color-mix(in srgb, var(--cyan) 20%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--surface) 68%, transparent);
}

.quality-validation-row {
  display: grid;
  gap: 6px;
}

.quality-validation-row strong {
  font-size: 14px;
}

.training-quality-card ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 18px;
}
</style>
