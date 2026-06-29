<script setup lang="ts">
// 训练资料工作区：只负责资料管理 UI，上传/发布/回滚等业务动作由父页面执行。
import {
  BadgeCheck,
  Eye,
  FileText,
  Layers3,
  RefreshCw,
  Route,
  Sparkles,
  Trash2,
} from 'lucide-vue-next'
import type {
  TrainingKnowledgeBatchResponse,
  TrainingKnowledgeChunkResponse,
  TrainingKnowledgePreviewResponse,
} from '../types'
import { displayValue } from '../composables/trainingDisplay'
import {
  canDeleteTrainingKnowledgeBatch,
  canOpenTrainingKnowledgeChunks,
  canPublishTrainingKnowledgeBatch,
  canReparseTrainingKnowledgeBatch,
  canRetryTrainingIngestTask,
  isTrainingIngestProcessing,
  trainingIngestProgress,
  trainingIngestStepLabel,
} from '../composables/trainingIngestTask'
import FilePreviewDialog from '../../../shared/components/FilePreviewDialog.vue'

interface ChunkTypeSummary {
  casePart: string
  label: string
  count: number
  usageLabels: string[]
  sampleText: string
}

const props = defineProps<{
  trainingBatches: TrainingKnowledgeBatchResponse[]
  batchTotal: number
  activeBatchId: string
  chunkTypeSummaries: ChunkTypeSummary[]
  activeChunkTypeChunks: TrainingKnowledgeChunkResponse[]
  activeChunkSummary: ChunkTypeSummary | null
  batchVersions: TrainingKnowledgeBatchResponse[]
  activeVersionGroupId: string
  trainingPreview: TrainingKnowledgePreviewResponse | null
  trainingPreviewLoading: boolean
  themeMode?: 'dark' | 'light'
  loadingBatches: boolean
  loadingChunks: boolean
  publishingBatchId: string
  rollingBackBatchId: string
  reparsingBatchId: string
  retryingTaskId: string
  previewingBatchId: string
  deletingBatchId: string
  versionLoading: boolean
  formatTime: (value: string | null | undefined) => string
  batchStatusLabel: (code: string) => string
  chunkSummaryTitle: (summary: ChunkTypeSummary) => string
  chunkUsageLabel: (code: string) => string
  casePartLabel: (code: string) => string
  chunkDetailMeta: (chunk: TrainingKnowledgeChunkResponse, index: number) => string
}>()

const batchPage = defineModel<number>('batchPage', { required: true })
const chunkStructureVisible = defineModel<boolean>('chunkStructureVisible', { required: true })
const chunkDetailVisible = defineModel<boolean>('chunkDetailVisible', { required: true })
const versionDialogVisible = defineModel<boolean>('versionDialogVisible', { required: true })
const trainingPreviewVisible = defineModel<boolean>('trainingPreviewVisible', { required: true })

const emit = defineEmits<{
  refreshBatches: []
  publishBatch: [batchId: string]
  reparseBatch: [batch: TrainingKnowledgeBatchResponse | string]
  retryTask: [batch: TrainingKnowledgeBatchResponse]
  rollbackBatch: [batch: TrainingKnowledgeBatchResponse]
  openBatchVersions: [batch: TrainingKnowledgeBatchResponse]
  openTrainingBatch: [batch: TrainingKnowledgeBatchResponse]
  previewBatch: [batch: TrainingKnowledgeBatchResponse]
  deleteBatch: [batch: TrainingKnowledgeBatchResponse]
  openChunkSummary: [summary: ChunkTypeSummary]
  closeChunkStructure: []
}>()

function handleChunkStructureVisibleChange(visible: boolean) {
  // Element Plus 关闭按钮和遮罩关闭会触发这里，统一交给父页面清理当前查看批次。
  chunkStructureVisible.value = visible
  if (!visible) {
    emit('closeChunkStructure')
  }
}
</script>

<template>
  <section class="training-knowledge-workspace">
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
          >
            <div class="batch-item-main">
              <strong>{{ batch.source_file }}</strong>
              <span>
                V{{ batch.version_no || 1 }} · {{ batch.is_current ? '当前版本' : batchStatusLabel(batch.status) }}
                · {{ batch.chunk_count }} 切片 · {{ batch.point_count }} 向量点
              </span>
              <em>{{ formatTime(batch.updated_at) }}</em>
            </div>
            <div v-if="isTrainingIngestProcessing(batch) || batch.task_status === 'failed'" class="batch-task-progress">
              <div>
                <strong>{{ trainingIngestStepLabel(batch) }}</strong>
                <span>{{ batch.task_status === 'failed' ? batch.error_message || '任务失败' : `${trainingIngestProgress(batch)}%` }}</span>
              </div>
              <el-progress
                :percentage="trainingIngestProgress(batch)"
                :status="batch.task_status === 'failed' ? 'exception' : undefined"
                :stroke-width="7"
              />
              <el-button
                v-if="canRetryTrainingIngestTask(batch)"
                class="batch-inline-retry"
                text
                size="small"
                :icon="RefreshCw"
                :loading="retryingTaskId === batch.task_id"
                @click.stop="emit('retryTask', batch)"
              >
                重试入库
              </el-button>
            </div>
            <div class="batch-item-meta">
              <span>MD5 去重</span>
              <code>{{ batch.file_md5 ? batch.file_md5.slice(0, 10) : '未记录' }}</code>
            </div>
            <div class="batch-action-row" @click.stop>
              <el-button
                class="batch-icon-button primary"
                :icon="Layers3"
                :loading="loadingChunks && activeBatchId === batch.batch_id"
                :disabled="!canOpenTrainingKnowledgeChunks(batch)"
                @click="emit('openTrainingBatch', batch)"
              >
                查看切片
              </el-button>
              <el-button
                v-if="canPublishTrainingKnowledgeBatch(batch)"
                class="batch-icon-button"
                :icon="BadgeCheck"
                :loading="publishingBatchId === batch.batch_id"
                @click="emit('publishBatch', batch.batch_id)"
              >
                发布
              </el-button>
              <el-button
                v-if="canReparseTrainingKnowledgeBatch(batch)"
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
                :disabled="!canDeleteTrainingKnowledgeBatch(batch)"
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
            v-if="batchTotal > 0"
            v-model:current-page="batchPage"
            size="small"
            layout="prev, pager, next"
            :page-size="9"
            :total="batchTotal"
            @current-change="emit('refreshBatches')"
          />
        </div>
      </div>
    </section>

    <el-dialog
      :model-value="chunkStructureVisible"
      width="980px"
      class="profile-config-dialog chunk-structure-dialog"
      @update:model-value="handleChunkStructureVisibleChange"
    >
      <template #header>
        <div class="chunk-detail-title">
          <Layers3 :size="20" />
          <strong>切片结构</strong>
          <span>{{ activeBatchId ? `${chunkTypeSummaries.length} 类切片` : '待选择资料' }}</span>
        </div>
      </template>
      <section class="chunk-structure-panel" v-loading="loadingChunks">
        <div class="chunk-summary-list large">
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
            <span>点击资料卡上的“查看切片”后展示资料结构。</span>
          </div>
        </div>
      </section>
      <template #footer>
        <el-button @click="handleChunkStructureVisibleChange(false)">关闭</el-button>
      </template>
    </el-dialog>

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
            <span>任务：{{ trainingIngestStepLabel(batch) }}</span>
            <span>切片：{{ batch.chunk_count }}</span>
            <span>向量点：{{ batch.point_count }}</span>
            <span>质量：{{ displayValue(batch.quality_report?.score ?? '-') }} 分</span>
          </div>
          <p v-if="batch.error_message">{{ batch.error_message }}</p>
          <footer>
            <el-button
              v-if="canPublishTrainingKnowledgeBatch(batch)"
              class="batch-icon-button"
              :icon="BadgeCheck"
              :loading="publishingBatchId === batch.batch_id"
              @click="emit('publishBatch', batch.batch_id)"
            >
              发布
            </el-button>
            <el-button
              v-if="canReparseTrainingKnowledgeBatch(batch)"
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
              class="batch-icon-button"
              :icon="FileText"
              :disabled="!canOpenTrainingKnowledgeChunks(batch)"
              @click="emit('openTrainingBatch', batch)"
            >
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
            <el-button
              v-if="canRetryTrainingIngestTask(batch)"
              class="batch-icon-button"
              :icon="RefreshCw"
              :loading="retryingTaskId === batch.task_id"
              @click="emit('retryTask', batch)"
            >
              重试
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

    <FilePreviewDialog
      v-model="trainingPreviewVisible"
      :loading="trainingPreviewLoading"
      :theme-mode="themeMode"
      title="训练资料预览"
      :preview="trainingPreview
        ? {
          file: {
            filename: trainingPreview.batch.source_file,
            file_type: trainingPreview.batch.source_file?.split('.').pop() || '未知类型',
            file_size: null,
          },
          preview_type: trainingPreview.preview_type,
          content: trainingPreview.content,
          truncated: trainingPreview.truncated,
          file_url: trainingPreview.file_url,
          charset: trainingPreview.charset,
        }
        : null"
    />
  </section>
</template>

<style scoped>
.training-knowledge-workspace {
  container-type: inline-size;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.training-panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
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

.training-batch-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.training-batch-list {
  display: grid;
  align-content: start;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding-right: 2px;
}

.training-batch-list > .training-empty,
.training-batch-list > .el-pagination {
  grid-column: 1 / -1;
}

.training-batch-item {
  position: relative;
  display: grid;
  align-content: start;
  gap: 8px;
  width: 100%;
  min-height: 188px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 14px;
  padding: 10px;
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
  gap: 4px;
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
  font-size: 11px;
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

.batch-task-progress {
  display: grid;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--cyan) 22%, var(--line));
  border-radius: 10px;
  padding: 7px 8px;
  background: color-mix(in srgb, var(--surface-strong) 64%, transparent);
}

.batch-task-progress > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.batch-task-progress strong,
.batch-task-progress span {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-task-progress strong {
  color: color-mix(in srgb, var(--text) 82%, var(--cyan));
}

.batch-task-progress span {
  color: var(--text-muted);
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.batch-icon-button.el-button {
  min-height: 28px;
  margin-left: 0;
  padding: 0 6px;
  border-color: color-mix(in srgb, var(--cyan) 34%, var(--line));
  color: var(--text);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 10%, transparent), transparent 58%),
    color-mix(in srgb, var(--surface-strong) 82%, transparent);
  font-size: 12px;
}

.batch-icon-button.primary.el-button {
  border-color: color-mix(in srgb, var(--cyan) 56%, var(--primary));
  color: color-mix(in srgb, var(--text) 82%, var(--cyan));
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

.chunk-structure-panel {
  display: grid;
  gap: 10px;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.chunk-summary-list.large {
  align-content: start;
  grid-template-columns: repeat(auto-fill, minmax(220px, 280px));
  justify-content: start;
  max-height: min(58dvh, 520px);
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  border-radius: 16px;
  padding: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 5%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface-strong) 54%, transparent);
}

.chunk-summary-list article {
  display: grid;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  border-radius: 12px;
  padding: 10px;
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
  font-size: 14px;
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
  -webkit-line-clamp: 4;
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
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  border: 1px solid color-mix(in srgb, var(--line) 72%, var(--cyan) 18%);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cyan) 5%, transparent), transparent 46%),
    color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: 0 22px 60px color-mix(in srgb, #000 28%, transparent);
}

:deep(.profile-config-dialog .el-dialog__header) {
  flex: 0 0 auto;
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
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 18px 20px;
}

:deep(.profile-config-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  padding: 14px 20px 18px;
}

@container (max-width: 520px) {
  .training-batch-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .training-batch-list,
  .chunk-summary-list.large,
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
