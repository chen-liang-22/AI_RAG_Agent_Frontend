<script setup lang="ts">
// 训练资料工作区：只负责资料管理 UI，上传/发布/回滚等业务动作由父页面执行。
import {
  BadgeCheck,
  CircleHelp,
  Eye,
  FileText,
  RefreshCw,
  Route,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-vue-next'
import type {
  TrainingKnowledgeBatchResponse,
  TrainingKnowledgeChunkResponse,
  TrainingKnowledgePreviewResponse,
  TrainingKnowledgeUploadResponse,
} from '../../api'
import { displayValue } from '../../utils/trainingDisplay'

interface ChunkTypeSummary {
  casePart: string
  label: string
  count: number
  usageLabels: string[]
  sampleText: string
}

const props = defineProps<{
  selectedFile: File | null
  uploadResult: TrainingKnowledgeUploadResponse | null
  trainingBatches: TrainingKnowledgeBatchResponse[]
  batchTotal: number
  activeBatchId: string
  chunkTypeSummaries: ChunkTypeSummary[]
  activeChunkTypeChunks: TrainingKnowledgeChunkResponse[]
  activeChunkSummary: ChunkTypeSummary | null
  batchVersions: TrainingKnowledgeBatchResponse[]
  activeVersionGroupId: string
  trainingPreview: TrainingKnowledgePreviewResponse | null
  loadingBatches: boolean
  loadingChunks: boolean
  uploading: boolean
  publishingBatchId: string
  rollingBackBatchId: string
  reparsingBatchId: string
  previewingBatchId: string
  deletingBatchId: string
  versionLoading: boolean
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
  formatTime: (value: string | null | undefined) => string
  batchStatusLabel: (code: string) => string
  qualityLevelLabel: (level: unknown) => string
  qualityLevelClass: (level: unknown) => string
  chunkSummaryTitle: (summary: ChunkTypeSummary) => string
  chunkUsageLabel: (code: string) => string
  casePartLabel: (code: string) => string
  chunkDetailMeta: (chunk: TrainingKnowledgeChunkResponse, index: number) => string
}>()

const batchPage = defineModel<number>('batchPage', { required: true })
const chunkDetailVisible = defineModel<boolean>('chunkDetailVisible', { required: true })
const versionDialogVisible = defineModel<boolean>('versionDialogVisible', { required: true })
const trainingPreviewVisible = defineModel<boolean>('trainingPreviewVisible', { required: true })

const emit = defineEmits<{
  fileChange: [file: File | undefined]
  clearUpload: []
  upload: []
  refreshBatches: []
  publishBatch: [batchId: string]
  reparseBatch: [batch: TrainingKnowledgeBatchResponse | string]
  rollbackBatch: [batch: TrainingKnowledgeBatchResponse]
  openBatchVersions: [batch: TrainingKnowledgeBatchResponse]
  openTrainingBatch: [batch: TrainingKnowledgeBatchResponse]
  previewBatch: [batch: TrainingKnowledgeBatchResponse]
  deleteBatch: [batch: TrainingKnowledgeBatchResponse]
  openChunkSummary: [summary: ChunkTypeSummary]
}>()

function onFileInputChange(event: Event) {
  // 文件 input 只把 File 对象交给父页面，组件本身不直接调用上传接口。
  const input = event.target as HTMLInputElement
  emit('fileChange', input.files?.[0])
}
</script>

<template>
  <section class="training-knowledge-workspace">
    <section class="training-panel">
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
        <span>上传后先生成切片预览和质量报告，人工确认后才写入 sales_training_cases。</span>
      </div>
      <el-button class="tech-button primary full" :icon="UploadCloud" :loading="uploading" @click="emit('upload')">
        上传并生成预览
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

    <section class="training-panel">
      <div class="panel-title panel-title-between">
        <span><FileText :size="16" /> 已上传资料</span>
        <el-button text :loading="loadingBatches" @click="emit('refreshBatches')">刷新</el-button>
      </div>
      <div class="training-batch-layout">
        <div class="training-batch-list" v-loading="loadingBatches">
          <article
            v-for="batch in trainingBatches"
            :key="batch.batch_id"
            class="training-batch-item"
            :class="{ active: activeBatchId === batch.batch_id }"
            @click="emit('openTrainingBatch', batch)"
          >
            <div class="batch-item-main">
              <strong>{{ batch.source_file }}</strong>
              <span>
                V{{ batch.version_no || 1 }} · {{ batch.is_current ? '当前版本' : batchStatusLabel(batch.status) }}
                · {{ batch.chunk_count }} 切片 · {{ batch.point_count }} 向量点
              </span>
              <em>{{ formatTime(batch.updated_at) }}</em>
            </div>
            <div class="batch-item-meta">
              <span>MD5 去重</span>
              <code>{{ batch.file_md5 ? batch.file_md5.slice(0, 10) : '未记录' }}</code>
            </div>
            <div class="batch-action-row" @click.stop>
              <el-button
                v-if="batch.status === 'pending_review' || batch.status === 'publish_failed'"
                class="batch-icon-button"
                :icon="BadgeCheck"
                :loading="publishingBatchId === batch.batch_id"
                @click="emit('publishBatch', batch.batch_id)"
              >
                发布
              </el-button>
              <el-button
                v-if="batch.status === 'pending_review' || batch.status === 'parsing_failed' || batch.status === 'publish_failed'"
                class="batch-icon-button"
                :icon="Sparkles"
                :loading="reparsingBatchId === batch.batch_id"
                @click="emit('reparseBatch', batch)"
              >
                重切
              </el-button>
              <el-button
                v-if="batch.status === 'archived'"
                class="batch-icon-button"
                :icon="RefreshCw"
                :loading="rollingBackBatchId === batch.batch_id"
                @click="emit('rollbackBatch', batch)"
              >
                回滚
              </el-button>
              <el-button
                v-if="batch.version_group_id"
                class="batch-icon-button"
                :icon="Route"
                @click="emit('openBatchVersions', batch)"
              >
                版本
              </el-button>
              <el-button
                class="batch-icon-button"
                :icon="Eye"
                :loading="previewingBatchId === batch.batch_id"
                @click="emit('previewBatch', batch)"
              >
                预览
              </el-button>
              <el-button
                class="batch-icon-button danger"
                :icon="Trash2"
                :loading="deletingBatchId === batch.batch_id"
                @click="emit('deleteBatch', batch)"
              >
                删除
              </el-button>
            </div>
          </article>
          <div v-if="trainingBatches.length === 0" class="training-empty compact">
            <FileText :size="24" />
            <span>暂无训练资料。</span>
          </div>
          <el-pagination
            v-model:current-page="batchPage"
            size="small"
            layout="prev, pager, next"
            :page-size="6"
            :total="batchTotal"
            @current-change="emit('refreshBatches')"
          />
        </div>
        <div class="chunk-summary-list large" v-loading="loadingChunks">
          <article
            v-for="summary in chunkTypeSummaries"
            :key="summary.casePart"
            class="clickable"
            role="button"
            tabindex="0"
            @click="emit('openChunkSummary', summary)"
            @keydown.enter.prevent="emit('openChunkSummary', summary)"
            @keydown.space.prevent="emit('openChunkSummary', summary)"
          >
            <div :title="chunkSummaryTitle(summary)">
              <strong>{{ summary.label }}</strong>
              <button type="button" @click.stop="emit('openChunkSummary', summary)">{{ summary.count }} 条分片</button>
            </div>
            <p>{{ summary.sampleText }}</p>
            <footer>
              <span v-for="usage in summary.usageLabels" :key="`${summary.casePart}-${usage}`">{{ usage }}</span>
            </footer>
          </article>
          <div v-if="chunkTypeSummaries.length === 0" class="training-empty compact">
            <FileText :size="24" />
            <span>点击左侧资料查看资料结构。</span>
          </div>
        </div>
      </div>
    </section>

    <el-dialog
      v-model="chunkDetailVisible"
      width="980px"
      class="profile-config-dialog chunk-detail-dialog"
      destroy-on-close
    >
      <template #header>
        <div class="chunk-detail-title">
          <FileText :size="20" />
          <strong>{{ activeChunkSummary?.label || '切片详情' }}</strong>
          <span>{{ activeChunkSummary?.count || 0 }} 条分片 · {{ activeChunkSummary?.usageLabels.join('、') || '未标记用途' }}</span>
        </div>
      </template>
      <section class="chunk-detail-body">
        <article
          v-for="(chunk, index) in activeChunkTypeChunks"
          :key="chunk.chunk_id"
          class="chunk-detail-item"
        >
          <header>
            <strong>{{ activeChunkSummary?.label || casePartLabel(chunk.case_part) }} {{ index + 1 }}</strong>
            <span>{{ chunkDetailMeta(chunk, index) }}</span>
          </header>
          <p>{{ chunk.chunk_text }}</p>
          <footer>
            <code>{{ chunk.chunk_id }}</code>
            <span>{{ chunk.case_part }}</span>
          </footer>
        </article>
        <div v-if="activeChunkTypeChunks.length === 0" class="training-empty compact">
          <FileText :size="24" />
          <span>当前类型暂无切片。</span>
        </div>
      </section>
      <template #footer>
        <el-button @click="chunkDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="versionDialogVisible"
      width="940px"
      class="profile-config-dialog version-chain-dialog"
      destroy-on-close
    >
      <template #header>
        <div class="chunk-detail-title">
          <Route :size="20" />
          <strong>训练资料版本链</strong>
          <span>版本组 {{ activeVersionGroupId || '未加载' }} · {{ batchVersions.length }} 个版本</span>
        </div>
      </template>
      <section class="version-chain-body" v-loading="versionLoading">
        <article
          v-for="batch in batchVersions"
          :key="batch.batch_id"
          class="version-chain-item"
          :class="{ current: batch.is_current }"
        >
          <header>
            <div>
              <strong>V{{ batch.version_no || 1 }} · {{ batch.source_file }}</strong>
              <span>{{ formatTime(batch.updated_at) }}</span>
            </div>
            <em>{{ batch.is_current ? '当前生效' : batchStatusLabel(batch.status) }}</em>
          </header>
          <div class="version-meta-grid">
            <span>状态：{{ batchStatusLabel(batch.status) }}</span>
            <span>切片：{{ batch.chunk_count }}</span>
            <span>向量点：{{ batch.point_count }}</span>
            <span>质量：{{ displayValue(batch.quality_report?.score ?? '-') }} 分</span>
          </div>
          <p v-if="batch.error_message">{{ batch.error_message }}</p>
          <footer>
            <el-button
              v-if="batch.status === 'pending_review' || batch.status === 'publish_failed'"
              class="batch-icon-button"
              :icon="BadgeCheck"
              :loading="publishingBatchId === batch.batch_id"
              @click="emit('publishBatch', batch.batch_id)"
            >
              发布
            </el-button>
            <el-button
              v-if="batch.status === 'pending_review' || batch.status === 'parsing_failed' || batch.status === 'publish_failed'"
              class="batch-icon-button"
              :icon="Sparkles"
              :loading="reparsingBatchId === batch.batch_id"
              @click="emit('reparseBatch', batch)"
            >
              重切
            </el-button>
            <el-button
              v-if="batch.status === 'archived'"
              class="batch-icon-button"
              :icon="RefreshCw"
              :loading="rollingBackBatchId === batch.batch_id"
              @click="emit('rollbackBatch', batch)"
            >
              回滚
            </el-button>
            <el-button class="batch-icon-button" :icon="FileText" @click="emit('openTrainingBatch', batch)">
              查看切片
            </el-button>
            <el-button
              class="batch-icon-button"
              :icon="Eye"
              :loading="previewingBatchId === batch.batch_id"
              @click="emit('previewBatch', batch)"
            >
              预览
            </el-button>
          </footer>
        </article>
        <div v-if="!versionLoading && batchVersions.length === 0" class="training-empty compact">
          <Route :size="24" />
          <span>暂无版本记录。</span>
        </div>
      </section>
      <template #footer>
        <el-button @click="versionDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="trainingPreviewVisible"
      title="训练资料预览"
      width="960px"
      class="profile-config-dialog training-preview-dialog"
      destroy-on-close
    >
      <section v-if="trainingPreview" class="training-preview-body">
        <div class="preview-file-head">
          <div>
            <strong>{{ trainingPreview.batch.source_file }}</strong>
            <span>{{ trainingPreview.batch.chunk_count }} 个切片 · {{ trainingPreview.preview_type }}</span>
          </div>
          <em v-if="trainingPreview.truncated">内容较长，已截断展示</em>
        </div>
        <pre>{{ trainingPreview.content || '该资料没有解析出可预览文本。' }}</pre>
      </section>
      <template #footer>
        <el-button @click="trainingPreviewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.training-knowledge-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 420px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

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

.training-panel > * {
  min-width: 0;
}

.panel-title-with-help {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.panel-title-with-help svg:last-child {
  color: color-mix(in srgb, var(--cyan) 78%, var(--text-muted));
  cursor: help;
}

.panel-title-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
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
  margin-bottom: 12px;
  border: 1px dashed color-mix(in srgb, var(--cyan) 42%, var(--line));
  border-radius: 16px;
  padding: 18px;
  color: var(--text);
  text-align: center;
  background:
    repeating-linear-gradient(90deg, color-mix(in srgb, var(--cyan) 10%, transparent) 0 1px, transparent 1px 34px),
    color-mix(in srgb, var(--surface) 68%, transparent);
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
}

.tech-button.full {
  width: 100%;
  margin-top: 12px;
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
  font-size: 19px;
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
  font-size: 22px;
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

.training-batch-layout {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 12px;
  min-height: 520px;
}

.training-batch-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.training-batch-item {
  position: relative;
  display: grid;
  gap: 9px;
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 14px;
  padding: 11px 12px;
  color: var(--text);
  text-align: left;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 44%),
    color-mix(in srgb, var(--surface) 76%, transparent);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.training-batch-item:hover,
.training-batch-item.active {
  border-color: color-mix(in srgb, var(--cyan) 62%, var(--primary));
  box-shadow: 0 0 22px color-mix(in srgb, var(--cyan) 18%, transparent);
  transform: translateY(-1px);
}

.training-batch-item.active::before {
  position: absolute;
  inset: 9px auto 9px 8px;
  width: 3px;
  border-radius: 999px;
  content: '';
  background: linear-gradient(180deg, var(--cyan), var(--primary));
  box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 58%, transparent);
}

.batch-item-main {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.batch-item-main strong,
.batch-item-main span,
.batch-item-main em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.training-batch-item.active .batch-item-main strong,
.training-batch-item.active .batch-item-main span,
.training-batch-item.active .batch-item-main em {
  padding-left: 10px;
}

.batch-item-main span,
.batch-item-main em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.batch-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, transparent);
  border-radius: 10px;
  padding: 6px 8px;
  background: color-mix(in srgb, var(--surface-strong) 70%, transparent);
}

.batch-item-meta span {
  color: var(--text-muted);
  font-size: 11px;
}

.batch-item-meta code {
  min-width: 0;
  overflow: hidden;
  color: var(--cyan);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.batch-icon-button.el-button {
  min-height: 32px;
  border-color: color-mix(in srgb, var(--cyan) 34%, var(--line));
  color: var(--text);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 10%, transparent), transparent 58%),
    color-mix(in srgb, var(--surface-strong) 82%, transparent);
}

.batch-icon-button.el-button:hover {
  border-color: color-mix(in srgb, var(--cyan) 62%, var(--primary));
  color: var(--cyan);
  box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 18%, transparent);
}

.batch-icon-button.danger.el-button {
  border-color: color-mix(in srgb, #ff6b7a 40%, var(--line));
  color: color-mix(in srgb, #ff6b7a 78%, var(--text));
}

.batch-icon-button.danger.el-button:hover {
  border-color: color-mix(in srgb, #ff6b7a 72%, var(--line));
  color: #ff6b7a;
  box-shadow: 0 0 16px color-mix(in srgb, #ff6b7a 18%, transparent);
}

.chunk-summary-list {
  display: grid;
  gap: 8px;
  max-height: 418px;
  overflow-y: auto;
}

.chunk-summary-list.large {
  align-content: start;
  max-height: 620px;
  min-height: 520px;
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  border-radius: 16px;
  padding: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 5%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface-strong) 54%, transparent);
}

.chunk-summary-list article {
  display: grid;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  border-radius: 14px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface) 66%, transparent);
}

.chunk-summary-list article.clickable {
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.chunk-summary-list article.clickable:hover,
.chunk-summary-list article.clickable:focus-visible {
  border-color: color-mix(in srgb, var(--cyan) 58%, var(--primary));
  box-shadow: 0 0 20px color-mix(in srgb, var(--cyan) 18%, transparent);
  outline: none;
  transform: translateY(-1px);
}

.chunk-summary-list article > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chunk-summary-list strong {
  color: var(--text);
  font-size: 15px;
}

.chunk-summary-list article > div button {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--cyan) 34%, var(--line));
  border-radius: 999px;
  padding: 3px 8px;
  color: var(--cyan);
  background: color-mix(in srgb, var(--cyan) 7%, transparent);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.chunk-summary-list article > div button:hover {
  border-color: color-mix(in srgb, var(--cyan) 70%, var(--primary));
  color: color-mix(in srgb, var(--text) 82%, var(--cyan));
}

.chunk-summary-list p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.65;
}

.chunk-summary-list.large p {
  -webkit-line-clamp: 7;
}

.chunk-summary-list footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chunk-summary-list footer span {
  border: 1px solid color-mix(in srgb, var(--green) 30%, var(--line));
  border-radius: 999px;
  padding: 3px 8px;
  color: color-mix(in srgb, var(--text) 72%, var(--green));
  background: color-mix(in srgb, var(--green) 8%, transparent);
  font-size: 12px;
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

.chunk-detail-title {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 10px;
  align-items: center;
}

.chunk-detail-title svg {
  grid-row: 1 / 3;
  color: var(--cyan);
}

.chunk-detail-title strong {
  color: var(--text);
  font-size: 18px;
}

.chunk-detail-title span {
  color: var(--text-muted);
  font-size: 12px;
}

.chunk-detail-body {
  display: grid;
  gap: 12px;
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;
}

.chunk-detail-item {
  display: grid;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cyan) 22%, var(--line));
  border-radius: 8px;
  padding: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-strong) 62%, transparent);
}

.chunk-detail-item header {
  display: grid;
  gap: 4px;
}

.chunk-detail-item header strong {
  color: var(--text);
  font-size: 15px;
}

.chunk-detail-item header span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.chunk-detail-item p {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.chunk-detail-item footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chunk-detail-item footer code,
.chunk-detail-item footer span {
  border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  border-radius: 999px;
  padding: 3px 8px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  font-size: 11px;
}

.version-chain-body {
  display: grid;
  gap: 12px;
  min-height: 120px;
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;
}

.version-chain-item {
  display: grid;
  gap: 11px;
  border: 1px solid color-mix(in srgb, var(--cyan) 22%, var(--line));
  border-radius: 8px;
  padding: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 50%),
    color-mix(in srgb, var(--surface-strong) 68%, transparent);
}

.version-chain-item.current {
  border-color: color-mix(in srgb, var(--green) 44%, var(--cyan));
  box-shadow: 0 0 18px color-mix(in srgb, var(--green) 12%, transparent);
}

.version-chain-item header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.version-chain-item header div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.version-chain-item header strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-chain-item header span,
.version-chain-item p {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.version-chain-item header em {
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--green) 34%, var(--line));
  border-radius: 999px;
  padding: 4px 9px;
  color: color-mix(in srgb, var(--green) 76%, var(--text));
  background: color-mix(in srgb, var(--green) 9%, transparent);
  font-size: 12px;
  font-style: normal;
}

.version-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.version-meta-grid span {
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  border-radius: 8px;
  padding: 7px 8px;
  color: var(--text-soft);
  background: color-mix(in srgb, var(--surface) 58%, transparent);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-chain-item footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.training-preview-body {
  display: grid;
  gap: 12px;
}

.preview-file-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--cyan) 24%, var(--line));
  border-radius: 14px;
  padding: 12px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 10%, transparent), transparent 52%),
    color-mix(in srgb, var(--surface-strong) 82%, transparent);
}

.preview-file-head div {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.preview-file-head strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-file-head span,
.preview-file-head em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.preview-file-head em {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, #f6c65b 44%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: #f6c65b;
  background: color-mix(in srgb, #f6c65b 9%, transparent);
}

.training-preview-body pre {
  max-height: 58vh;
  overflow: auto;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--cyan) 18%, var(--line));
  border-radius: 14px;
  padding: 14px;
  color: var(--text);
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--cyan) 7%, transparent), transparent 36%),
    color-mix(in srgb, var(--surface) 88%, transparent);
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

@media (max-width: 1320px) {
  .training-knowledge-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .training-batch-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .training-kpi-grid,
  .version-meta-grid {
    grid-template-columns: 1fr;
  }

  .preview-file-head,
  .version-chain-item header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
