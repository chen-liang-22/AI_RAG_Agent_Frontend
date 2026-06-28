<script setup lang="ts">
import { computed } from 'vue'
import { FileText } from 'lucide-vue-next'

interface PreviewFileMeta {
  filename: string
  file_type?: string | null
  file_size?: number | null
}

interface FilePreviewPayload {
  file: PreviewFileMeta
  preview_type: string
  content: string
  truncated: boolean
  file_url?: string | null
  charset?: string | null
}

const props = defineProps<{
  preview: FilePreviewPayload | null
  loading?: boolean
  title?: string
  themeMode?: 'dark' | 'light'
}>()

const visible = defineModel<boolean>({ required: true })

const previewTitle = computed(() => props.title || '文件预览')
const cleanFileUrl = computed(() => String(props.preview?.file_url || '').trim())
const isTextPreview = computed(() => props.preview?.preview_type === 'text')
const canFramePreview = computed(() => Boolean(cleanFileUrl.value) && !isTextPreview.value)

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

</script>

<template>
  <el-dialog
    v-model="visible"
    :class="['file-preview-dialog', `theme-${themeMode || 'dark'}`]"
    :title="previewTitle"
    width="1040px"
    destroy-on-close
  >
    <section v-loading="loading" class="file-preview-shell">
      <template v-if="preview">
        <header class="file-preview-header">
          <div class="file-preview-title">
            <FileText :size="20" />
            <div>
              <strong>{{ preview.file.filename }}</strong>
              <span>
                {{ preview.file.file_type || '未知类型' }}
                · {{ formatFileSize(preview.file.file_size) }}
                <template v-if="preview.charset"> · {{ preview.charset }}</template>
              </span>
            </div>
          </div>
        </header>

        <div v-if="preview.truncated" class="file-preview-warning">
          内容较长，当前只展示前半部分内容。
        </div>

        <pre v-if="isTextPreview" class="file-preview-text">{{ preview.content || '没有解析出可预览文本。' }}</pre>
        <iframe
          v-else-if="canFramePreview"
          class="file-preview-frame"
          :src="cleanFileUrl"
          title="文件预览"
        />
        <div v-else class="file-preview-empty">
          当前文件暂不能在弹窗中预览，可以点击“新窗口”查看原文件。
        </div>
      </template>
    </section>
  </el-dialog>
</template>

<style scoped>
.file-preview-shell {
  display: grid;
  gap: 12px;
  min-height: 520px;
}

.file-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--line, rgba(148, 163, 184, 0.26)) 78%, #22d3ee 22%);
  border-radius: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, #22d3ee 10%, transparent), color-mix(in srgb, #8b5cf6 8%, transparent)),
    color-mix(in srgb, var(--card-bg, rgba(15, 23, 42, 0.88)) 92%, transparent);
}

.file-preview-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.file-preview-title strong,
.file-preview-title span {
  display: block;
  overflow: hidden;
  max-width: 760px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview-title span {
  margin-top: 3px;
  color: var(--text-muted, rgba(148, 163, 184, 0.86));
  font-size: 12px;
}

.file-preview-warning {
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, #f59e0b 45%, transparent);
  border-radius: 8px;
  color: #fbbf24;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
}

.file-preview-text,
.file-preview-frame,
.file-preview-empty {
  min-height: 470px;
  border: 1px solid color-mix(in srgb, var(--line, rgba(148, 163, 184, 0.24)) 80%, #22d3ee 20%);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-bg, rgba(2, 6, 23, 0.9)) 94%, transparent);
}

.file-preview-text {
  overflow: auto;
  margin: 0;
  padding: 16px;
  color: var(--text-primary, #e5eefb);
  font-family: Consolas, 'Microsoft YaHei UI', monospace;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.file-preview-frame {
  width: 100%;
  height: 62vh;
}

.file-preview-empty {
  display: grid;
  place-items: center;
  color: var(--text-muted, rgba(148, 163, 184, 0.86));
}

.theme-light .file-preview-text,
.theme-light .file-preview-frame,
.theme-light .file-preview-empty {
  background: rgba(248, 250, 252, 0.96);
}
</style>
