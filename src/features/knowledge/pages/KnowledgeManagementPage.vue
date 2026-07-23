<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Bot,
  BookKey,
  BrainCircuit,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  confirmKnowledgeUpload,
  deleteKnowledgeFile,
  fetchHealth,
  fetchKnowledgeUploadOptions,
  listDictionaries,
  listKnowledgeFiles,
  previewKnowledgeDocument,
  previewKnowledgeFile,
  recommendKnowledgeUpload,
  reindexAllKnowledgeFiles,
  reindexKnowledgeFile,
  type DictionaryGroupResponse,
  type DictionaryItemResponse,
  type HealthResponse,
  type KnowledgeFilePreviewResponse,
  type KnowledgeFileResponse,
  type KnowledgeUploadOptionsResponse,
  type KnowledgeUploadPreviewResponse,
  type KnowledgeUploadRecommendResponse,
} from '../../../shared/api'
import FilePreviewDialog from '../../../shared/components/FilePreviewDialog.vue'
import {
  DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS,
  normalizeKnowledgeUploadOptions,
} from '../../../shared/knowledgeUploadOptions'

const props = defineProps<{
  themeMode: 'dark' | 'light'
}>()

const emit = defineEmits<{
  openSalesTrainingKnowledge: []
}>()

const SALES_TRAINING_COLLECTION = 'sales_training_cases'

// 销售训练入库过程使用的技术临时 collection 不得在正式知识库中展示或写入。
const RESERVED_KNOWLEDGE_COLLECTIONS = new Set([
  'sales_training_cases_staging',
])

const knowledgeFiles = ref<KnowledgeFileResponse[]>([])
const health = ref<HealthResponse | null>(null)
const dictionaryGroups = ref<DictionaryGroupResponse[]>([])
const uploadOptions = ref<KnowledgeUploadOptionsResponse>(DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS)
const knowledgeLoading = ref(false)
const uploadOptionsLoading = ref(false)
const uploadingKnowledge = ref(false)
const confirmingKnowledge = ref(false)
const recommendingKnowledge = ref(false)
const reindexingAll = ref(false)
const activeKnowledgeAction = ref('')
const knowledgeError = ref('')
const knowledgeKeyword = ref('')
const activeKnowledgeCollection = ref('')
const knowledgePage = ref(1)
const knowledgePageSize = 9
const knowledgeFileInput = ref<HTMLInputElement | null>(null)
const uploadTypeDialogVisible = ref(false)
const uploadPreviewVisible = ref(false)
const uploadPreview = ref<KnowledgeUploadPreviewResponse | null>(null)
const uploadRecommendation = ref<KnowledgeUploadRecommendResponse | null>(null)
const selectedUploadCollection = ref('agent')
const selectedDocumentType = ref('')
const selectedSplitStrategy = ref('')
const knowledgePreviewVisible = ref(false)
const knowledgePreviewLoading = ref(false)
const knowledgePreview = ref<KnowledgeFilePreviewResponse | null>(null)

function isReservedKnowledgeCollection(collectionName: string): boolean { // 判断是否为知识库技术临时 collection
  return RESERVED_KNOWLEDGE_COLLECTIONS.has(collectionName.trim())
}

function isSalesTrainingCollection(collectionName: string): boolean { // 判断是否为销售训练正式 collection
  return collectionName.trim() === SALES_TRAINING_COLLECTION
}

// 汇总健康检查和已入库文件中的正式 collection，作为全局列表页签。
const collectionOptions = computed(() => {
  const names = new Set<string>([health.value?.collection_name || 'agent'])
  for (const collectionName of health.value?.collections || []) {
    if (collectionName) names.add(collectionName)
  }
  for (const file of knowledgeFiles.value) {
    if (file.collection_name) names.add(file.collection_name)
  }
  return Array.from(names)
    .filter((collectionName) => !isReservedKnowledgeCollection(collectionName))
    .sort((left, right) => left.localeCompare(right))
})

// 通用上传不得选择销售训练正式库，该库只能通过销售训练批次流程发布。
const generalUploadCollectionOptions = computed(() => (
  collectionOptions.value.filter((collectionName) => !isSalesTrainingCollection(collectionName))
))

// 为每个 collection 计算文件总数和已索引数，供页签展示真实状态。
const knowledgeCollectionTabs = computed(() => (
  collectionOptions.value.map((collectionName) => {
    const files = knowledgeFiles.value.filter((file) => file.collection_name === collectionName)
    return {
      collectionName,
      total: files.length,
      indexed: files.filter((file) => file.status === 'indexed').length,
    }
  })
))

// 先按当前页签筛选文件，再在该 collection 内执行文件名查询。
const filteredKnowledgeFiles = computed(() => {
  const files = activeKnowledgeCollection.value
    ? knowledgeFiles.value.filter((file) => file.collection_name === activeKnowledgeCollection.value)
    : knowledgeFiles.value
  const keyword = knowledgeKeyword.value.trim().toLowerCase()
  if (!keyword) return files
  return files.filter((file) => file.filename.toLowerCase().includes(keyword))
})

// 从筛选结果中截取当前页需要展示的文件。
const pagedKnowledgeFiles = computed(() => {
  const start = (knowledgePage.value - 1) * knowledgePageSize
  return filteredKnowledgeFiles.value.slice(start, start + knowledgePageSize)
})

// 统计当前 collection 已完成向量索引的文件数。
const activeIndexedKnowledgeCount = computed(() => (
  filteredKnowledgeFiles.value.filter((file) => file.status === 'indexed').length
))

// 只有上传预览、目标 collection、文档结构和切分策略齐全时才允许确认入库。
const canConfirmUpload = computed(() => Boolean(
  uploadPreview.value
  && selectedUploadCollection.value.trim()
  && selectedDocumentType.value
  && selectedSplitStrategy.value,
))

watch(knowledgeKeyword, () => {
  // 查询条件变化后回到第一页，避免旧页码落在新结果范围之外。
  knowledgePage.value = 1
})

watch(activeKnowledgeCollection, () => {
  // 切换 collection 后从第一页开始展示该库文件。
  knowledgePage.value = 1
})

watch(collectionOptions, (collections) => {
  // 列表刷新后确保当前页签仍然存在，不存在时自动切到第一个 collection。
  if (!collections.length) {
    activeKnowledgeCollection.value = ''
    return
  }
  if (!activeKnowledgeCollection.value || !collections.includes(activeKnowledgeCollection.value)) {
    activeKnowledgeCollection.value = collections[0]
  }
}, { immediate: true })

function flattenDictionaryItems(items: DictionaryItemResponse[]): DictionaryItemResponse[] { // 递归拉平字典树供下拉和状态展示使用
  return items.flatMap((item) => [item, ...flattenDictionaryItems(item.children || [])])
}

function allDictionaryItems(dictionaryCode: string): DictionaryItemResponse[] { // 按编码读取一个字典分组的全部层级项
  const group = dictionaryGroups.value.find((item) => item.dictionary_code === dictionaryCode)
  return flattenDictionaryItems(group?.items || [])
}

function dictionaryItems(dictionaryCode: string): DictionaryItemResponse[] { // 按编码读取一个字典分组中的启用项
  return allDictionaryItems(dictionaryCode).filter((item) => item.enabled)
}

function dictionaryDefaultCode(dictionaryCode: string): string { // 使用排序最靠前的启用字典项作为默认编码
  return dictionaryItems(dictionaryCode)[0]?.item_code || ''
}

function dictionaryCodeByMetadata(
  dictionaryCode: string,
  key: string,
  value: unknown,
): string { // 按 metadata 业务标记查找字典项编码
  return dictionaryItems(dictionaryCode).find((item) => item.metadata?.[key] === value)?.item_code || ''
}

function isKnowledgeResultStatus(
  status: string,
  metadataKey: string,
  metadataValue: unknown,
): boolean { // 判断知识库接口返回的业务结果类型
  const targetCode = dictionaryCodeByMetadata('knowledge_result_status', metadataKey, metadataValue)
  return Boolean(targetCode) && status === targetCode
}

function knowledgeStatusType(status: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' { // 将文件状态转换为标签样式
  const item = dictionaryItems('document_status').find((option) => option.item_code === status)
  const tagType = String(item?.metadata?.tag_type || 'info')
  if (['success', 'warning', 'info', 'primary', 'danger'].includes(tagType)) {
    return tagType as 'success' | 'warning' | 'info' | 'primary' | 'danger'
  }
  return 'info'
}

function knowledgeStatusLabel(status: string): string { // 优先使用字典名称展示文件状态，缺少配置时保留后端状态码
  return allDictionaryItems('document_status').find((item) => item.item_code === status)?.item_name || status
}

function formatFileSize(size: number): string { // 将字节数格式化为便于阅读的文件大小
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDateTime(value: string): string { // 将后端 ISO 时间格式化到秒
  return value.replace('T', ' ').slice(0, 19)
}

function knowledgeActionKey(action: string, documentId: string): string { // 为文件行操作生成唯一 loading 标识
  return `${action}:${documentId}`
}

async function refreshHealth(): Promise<void> { // 读取 Qdrant 健康状态和可用 collection 列表
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

async function refreshDictionaries(): Promise<void> { // 读取文档结构、切分策略和状态展示所需字典
  try {
    dictionaryGroups.value = await listDictionaries()
    selectedDocumentType.value ||= dictionaryDefaultCode('document_structure')
    selectedSplitStrategy.value ||= dictionaryDefaultCode('split_strategy')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识库字典加载失败')
  }
}

async function refreshUploadOptions(): Promise<void> { // 读取后端实际支持的文件类型和大小限制
  uploadOptionsLoading.value = true
  try {
    uploadOptions.value = normalizeKnowledgeUploadOptions(await fetchKnowledgeUploadOptions())
  } catch (error) {
    uploadOptions.value = DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS
    ElMessage.warning(error instanceof Error ? error.message : '上传配置读取失败，已使用默认格式')
  } finally {
    uploadOptionsLoading.value = false
  }
}

async function refreshKnowledgeFiles(): Promise<void> { // 刷新全部正式知识库文件并修正当前页码
  knowledgeLoading.value = true
  knowledgeError.value = ''
  try {
    const files = await listKnowledgeFiles(true)
    knowledgeFiles.value = files.filter((file) => !isReservedKnowledgeCollection(file.collection_name))
    const maxPage = Math.max(1, Math.ceil(filteredKnowledgeFiles.value.length / knowledgePageSize))
    knowledgePage.value = Math.min(knowledgePage.value, maxPage)
  } catch (error) {
    knowledgeError.value = error instanceof Error ? error.message : '知识库文件列表加载失败'
    ElMessage.error(knowledgeError.value)
  } finally {
    knowledgeLoading.value = false
  }
}

function openKnowledgeUploadTypeDialog(): void { // 打开资料类型选择弹窗
  uploadTypeDialogVisible.value = true
}

function openKnowledgeFilePicker(): void { // 选择通用知识并触发原生文件选择框
  uploadTypeDialogVisible.value = false
  knowledgeFileInput.value?.click()
}

function openSalesTrainingKnowledgeUpload(): void { // 进入销售训练既有资料管理流程
  uploadTypeDialogVisible.value = false
  emit('openSalesTrainingKnowledge')
}

async function handleKnowledgeFileChange(event: Event): Promise<void> { // 上传用户选中的单个文件并打开预解析确认弹窗
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const maxFileSize = uploadOptions.value.max_file_size_bytes
  if (maxFileSize && file.size > maxFileSize) {
    ElMessage.error(`文件大小不能超过 ${formatFileSize(maxFileSize)}`)
    target.value = ''
    return
  }

  uploadingKnowledge.value = true
  try {
    const response = await previewKnowledgeFile(file)
    if (response.duplicate) {
      ElMessage.info('当前已有相同内容文件，也可以选择新 Collection 后继续入库')
    }
    uploadPreview.value = response
    uploadRecommendation.value = null
    selectedDocumentType.value = response.detected_type || dictionaryDefaultCode('document_structure')
    selectedSplitStrategy.value = response.split_strategy || dictionaryDefaultCode('split_strategy')
    selectedUploadCollection.value = generalUploadCollectionOptions.value.includes(activeKnowledgeCollection.value)
      ? activeKnowledgeCollection.value
      : generalUploadCollectionOptions.value[0] || 'agent'
    uploadPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件预解析失败')
  } finally {
    uploadingKnowledge.value = false
    target.value = ''
  }
}

async function handleRecommendKnowledgeUpload(): Promise<void> { // 调用模型推荐当前文件的文档结构和切分策略
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

async function handleConfirmKnowledgeUpload(): Promise<void> { // 使用确认后的 collection 和切分配置正式提交入库
  if (!uploadPreview.value || confirmingKnowledge.value || !canConfirmUpload.value) return
  const targetCollection = selectedUploadCollection.value.trim()
  if (isReservedKnowledgeCollection(targetCollection)) {
    ElMessage.warning('销售训练临时集合不能作为上传目标')
    return
  }
  if (isSalesTrainingCollection(targetCollection)) {
    ElMessage.warning('销售训练资料请通过销售训练资料上传流程处理')
    return
  }
  confirmingKnowledge.value = true
  try {
    const response = await confirmKnowledgeUpload(
      uploadPreview.value.upload_id,
      selectedDocumentType.value,
      selectedSplitStrategy.value,
      targetCollection,
    )
    if (isKnowledgeResultStatus(response.status, 'result_kind', 'duplicate')) {
      ElMessage.info(response.message || '相同内容的文件已经存在')
    } else {
      ElMessage.success(response.message || '文件已保存，正在后台入库')
    }
    activeKnowledgeCollection.value = targetCollection
    uploadPreviewVisible.value = false
    uploadPreview.value = null
    uploadRecommendation.value = null
    await Promise.all([refreshKnowledgeFiles(), refreshHealth()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件入库失败')
  } finally {
    confirmingKnowledge.value = false
  }
}

function resetUploadPreview(): void { // 关闭确认弹窗后清理本次上传的临时页面状态
  uploadPreview.value = null
  uploadRecommendation.value = null
}

async function handlePreviewKnowledgeFile(file: KnowledgeFileResponse): Promise<void> { // 在站内弹窗预览已入库文件正文
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
    if (activeKnowledgeAction.value === actionKey) activeKnowledgeAction.value = ''
  }
}

async function handleReindexKnowledgeFile(file: KnowledgeFileResponse): Promise<void> { // 用户确认后重新构建单个文件的向量索引
  try {
    await ElMessageBox.confirm(
      `确定重新索引「${file.filename}」吗？`,
      '重新索引',
      { confirmButtonText: '重新索引', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  activeKnowledgeAction.value = knowledgeActionKey('reindex', file.document_id)
  try {
    await reindexKnowledgeFile(file.document_id)
    ElMessage.success('已重新索引')
    await Promise.all([refreshKnowledgeFiles(), refreshHealth()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重新索引失败')
  } finally {
    activeKnowledgeAction.value = ''
  }
}

async function handleReindexAllKnowledgeFiles(): Promise<void> { // 用户确认后清空旧向量并重建全部通用知识库文件
  try {
    await ElMessageBox.confirm(
      '确定清空旧向量并重新索引全部知识库文件吗？这个操作会重新生成向量，文件多时会比较慢。',
      '清空并重建',
      { confirmButtonText: '清空并重建', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  reindexingAll.value = true
  try {
    const response = await reindexAllKnowledgeFiles()
    if (response.failed > 0) {
      ElMessage.warning(`重建完成：成功 ${response.succeeded} 个，失败 ${response.failed} 个`)
    } else {
      ElMessage.success(`全部重建完成：${response.succeeded} 个文件`)
    }
    await Promise.all([refreshKnowledgeFiles(), refreshHealth()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清空并重建失败')
  } finally {
    reindexingAll.value = false
  }
}

async function handleDeleteKnowledgeFile(file: KnowledgeFileResponse): Promise<void> { // 用户确认后删除文件及其向量索引
  try {
    await ElMessageBox.confirm(
      `确定删除「${file.filename}」吗？`,
      '删除知识库文件',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  activeKnowledgeAction.value = knowledgeActionKey('delete', file.document_id)
  try {
    await deleteKnowledgeFile(file.document_id)
    ElMessage.success('已删除知识库文件')
    await Promise.all([refreshKnowledgeFiles(), refreshHealth()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    activeKnowledgeAction.value = ''
  }
}

onMounted(() => {
  // 页面打开后并发读取真实文件、collection、字典和上传能力配置。
  void Promise.all([
    refreshKnowledgeFiles(),
    refreshHealth(),
    refreshDictionaries(),
    refreshUploadOptions(),
  ])
})
</script>

<template>
  <section class="knowledge-management-page" :class="`theme-${props.themeMode}`">
    <header class="knowledge-page-header">
      <div class="knowledge-page-title">
        <span class="knowledge-page-icon"><BookKey :size="22" /></span>
        <div>
          <h2>知识库管理</h2>
          <p>文件入库与向量索引</p>
        </div>
      </div>
      <div class="knowledge-page-summary" aria-label="知识库概览">
        <span><strong>{{ knowledgeFiles.length }}</strong> 文件</span>
        <span><strong>{{ collectionOptions.length }}</strong> Collections</span>
        <span><strong>{{ knowledgeFiles.filter((file) => file.status === 'indexed').length }}</strong> 已索引</span>
      </div>
      <div class="knowledge-page-actions">
        <el-tooltip :content="`支持 ${uploadOptions.display_text}`" placement="bottom">
          <el-button
            :icon="Upload"
            :loading="uploadingKnowledge || uploadOptionsLoading"
            type="primary"
            @click="openKnowledgeUploadTypeDialog"
          >
            上传文件
          </el-button>
        </el-tooltip>
        <el-button :icon="RefreshCw" :loading="knowledgeLoading" @click="refreshKnowledgeFiles">
          刷新
        </el-button>
        <el-button
          :icon="RefreshCw"
          :loading="reindexingAll"
          type="warning"
          plain
          @click="handleReindexAllKnowledgeFiles"
        >
          清空并重建
        </el-button>
      </div>
      <input
        ref="knowledgeFileInput"
        class="hidden-file-input"
        type="file"
        :accept="uploadOptions.accept"
        @change="handleKnowledgeFileChange"
      >
    </header>

    <nav class="knowledge-collection-tabs" role="tablist" aria-label="知识库列表">
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
    </nav>

    <section class="knowledge-workspace">
      <header class="knowledge-toolbar">
        <div class="knowledge-toolbar-summary">
          <strong>{{ filteredKnowledgeFiles.length }}</strong>
          <span>个文件</span>
          <em>{{ activeIndexedKnowledgeCount }} 个已索引</em>
        </div>
        <el-input
          v-model="knowledgeKeyword"
          class="knowledge-search-input"
          clearable
          :prefix-icon="Search"
          placeholder="按文件名查询"
        />
      </header>

      <div v-loading="knowledgeLoading" class="knowledge-list-body">
        <div v-if="knowledgeError" class="knowledge-error-state">
          <span>{{ knowledgeError }}</span>
          <el-button :icon="RefreshCw" @click="refreshKnowledgeFiles">重试</el-button>
        </div>
        <el-empty v-else-if="knowledgeFiles.length === 0" description="暂无知识库文件" />
        <el-empty v-else-if="filteredKnowledgeFiles.length === 0" description="没有匹配的知识库文件" />
        <div v-else class="knowledge-grid">
          <article v-for="file in pagedKnowledgeFiles" :key="file.document_id" class="knowledge-file">
            <div class="knowledge-file-main">
              <span class="knowledge-file-icon"><FileText :size="18" /></span>
              <div class="knowledge-file-info">
                <strong :title="file.filename">{{ file.filename }}</strong>
                <span>
                  {{ file.file_type.toUpperCase() }} · {{ formatFileSize(file.file_size) }} ·
                  {{ file.chunk_count }} chunks
                </span>
              </div>
              <el-tag :type="knowledgeStatusType(file.status)" effect="plain" size="small">
                {{ knowledgeStatusLabel(file.status) }}
              </el-tag>
            </div>
            <div class="knowledge-file-meta">
              <span>版本 v{{ file.version }}</span>
              <span>{{ formatDateTime(file.updated_at) }}</span>
            </div>
            <div v-if="file.error_message" class="knowledge-error">
              {{ file.error_message }}
            </div>
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

      <footer class="knowledge-pagination">
        <el-pagination
          v-model:current-page="knowledgePage"
          background
          layout="total, prev, pager, next"
          :page-size="knowledgePageSize"
          :total="filteredKnowledgeFiles.length"
        />
      </footer>
    </section>

    <el-dialog
      v-model="uploadTypeDialogVisible"
      :class="['upload-type-dialog', `theme-${props.themeMode}`]"
      title="选择资料类型"
      width="520px"
      destroy-on-close
    >
      <div class="knowledge-upload-type-options">
        <button type="button" class="knowledge-upload-type-option" @click="openKnowledgeFilePicker">
          <span class="knowledge-upload-type-icon"><BookKey :size="20" /></span>
          <strong>通用知识</strong>
        </button>
        <button type="button" class="knowledge-upload-type-option" @click="openSalesTrainingKnowledgeUpload">
          <span class="knowledge-upload-type-icon"><BrainCircuit :size="20" /></span>
          <strong>销售训练资料</strong>
        </button>
      </div>
    </el-dialog>

    <FilePreviewDialog
      v-model="knowledgePreviewVisible"
      :loading="knowledgePreviewLoading"
      :theme-mode="props.themeMode"
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

    <el-dialog
      v-model="uploadPreviewVisible"
      :class="['upload-preview-dialog', `theme-${props.themeMode}`]"
      title="确认入库配置"
      width="680px"
      destroy-on-close
      @closed="resetUploadPreview"
    >
      <div v-if="uploadPreview" class="upload-preview">
        <div class="preview-summary">
          <div><span>文件</span><strong>{{ uploadPreview.filename }}</strong></div>
          <div><span>大小</span><strong>{{ formatFileSize(uploadPreview.file_size) }}</strong></div>
          <div><span>推荐来源</span><strong>{{ uploadRecommendation ? '模型' : '系统识别' }}</strong></div>
        </div>

        <div class="recommend-toolbar">
          <div>
            <strong>
              {{ uploadRecommendation
                ? `模型置信度 ${Math.round(uploadRecommendation.confidence * 100)}%`
                : `识别置信度 ${Math.round(uploadPreview.confidence * 100)}%` }}
            </strong>
            <span v-if="uploadRecommendation">
              {{ uploadRecommendation.model_name }} · {{ uploadRecommendation.sample_chars }} 字符样本
            </span>
          </div>
          <el-button
            :icon="Bot"
            :loading="recommendingKnowledge"
            :disabled="confirmingKnowledge"
            type="primary"
            plain
            @click="handleRecommendKnowledgeUpload"
          >
            模型推荐
          </el-button>
        </div>

        <div class="preview-form">
          <label>
            <span>Collection</span>
            <el-select
              v-model="selectedUploadCollection"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入 Collection"
            >
              <el-option
                v-for="collectionName in generalUploadCollectionOptions"
                :key="collectionName"
                :label="collectionName"
                :value="collectionName"
              />
            </el-select>
          </label>
          <label>
            <span>文档结构</span>
            <el-select v-model="selectedDocumentType" placeholder="选择文档结构">
              <el-option
                v-for="item in dictionaryItems('document_structure')"
                :key="item.item_code"
                :label="item.item_name"
                :value="item.item_code"
              />
            </el-select>
          </label>
          <label>
            <span>切分策略</span>
            <el-select v-model="selectedSplitStrategy" placeholder="选择切分策略">
              <el-option
                v-for="item in dictionaryItems('split_strategy')"
                :key="item.item_code"
                :label="item.item_name"
                :value="item.item_code"
              />
            </el-select>
          </label>
        </div>

        <div class="preview-reasons">
          <span>{{ uploadRecommendation ? '模型推荐原因' : '识别依据' }}</span>
          <p v-for="reason in (uploadRecommendation?.reasons || uploadPreview.reasons)" :key="reason">
            {{ reason }}
          </p>
        </div>

        <div class="preview-sample">
          <span>文本预览</span>
          <pre>{{ uploadPreview.sample_text }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button :disabled="confirmingKnowledge" @click="uploadPreviewVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="confirmingKnowledge"
          :disabled="!canConfirmUpload"
          @click="handleConfirmKnowledgeUpload"
        >
          确认入库
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.knowledge-management-page {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--text);
}

.knowledge-page-header {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 18px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.knowledge-page-title,
.knowledge-page-summary,
.knowledge-page-actions,
.knowledge-toolbar,
.knowledge-toolbar-summary,
.knowledge-file-main,
.knowledge-file-meta,
.knowledge-file-actions,
.recommend-toolbar {
  display: flex;
  align-items: center;
}

.knowledge-page-title {
  gap: 10px;
  min-width: 0;
}

.knowledge-page-icon,
.knowledge-file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--primary);
}

.knowledge-page-icon {
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--primary) 32%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 10%, var(--surface));
}

.knowledge-page-title h2,
.knowledge-page-title p {
  margin: 0;
}

.knowledge-page-title h2 {
  font-size: 19px;
}

.knowledge-page-title p {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
}

.knowledge-page-summary {
  gap: 14px;
  color: var(--text-muted);
  font-size: 12px;
}

.knowledge-page-summary strong {
  margin-right: 3px;
  color: var(--text);
  font-size: 15px;
}

.knowledge-page-actions {
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.knowledge-collection-tabs {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding: 0 2px 4px;
  overflow-x: auto;
}

.knowledge-collection-tab {
  display: grid;
  gap: 3px;
  flex: 0 0 auto;
  min-width: 148px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface);
  cursor: pointer;
  text-align: left;
}

.knowledge-collection-tab.active {
  border-color: color-mix(in srgb, var(--primary) 58%, var(--line));
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  box-shadow: inset 3px 0 0 var(--primary);
}

.knowledge-collection-tab em {
  color: var(--text-muted);
  font-size: 11px;
  font-style: normal;
}

.knowledge-workspace {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: var(--shadow-sm);
}

.knowledge-toolbar {
  justify-content: space-between;
  gap: 12px;
}

.knowledge-toolbar-summary {
  gap: 5px;
  min-width: 150px;
}

.knowledge-toolbar-summary strong {
  font-size: 22px;
}

.knowledge-toolbar-summary span,
.knowledge-toolbar-summary em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.knowledge-search-input {
  width: min(320px, 100%);
}

.knowledge-list-body {
  min-height: 0;
  overflow: auto;
}

.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.knowledge-file {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
}

.knowledge-file-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 9px;
}

.knowledge-file-info {
  min-width: 0;
}

.knowledge-file-info strong,
.knowledge-file-info span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-file-info span,
.knowledge-file-meta {
  color: var(--text-muted);
  font-size: 11px;
}

.knowledge-file-meta {
  justify-content: space-between;
  gap: 8px;
}

.knowledge-file-actions {
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.knowledge-error,
.knowledge-error-state {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 34%, var(--line));
  border-radius: 8px;
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, var(--surface));
}

.knowledge-error {
  font-size: 12px;
}

.knowledge-error-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.knowledge-pagination {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.hidden-file-input {
  display: none;
}

.knowledge-upload-type-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.knowledge-upload-type-option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface-2);
  cursor: pointer;
  text-align: left;
}

.knowledge-upload-type-option:hover,
.knowledge-upload-type-option:focus-visible {
  border-color: color-mix(in srgb, var(--primary) 58%, var(--line));
  background: color-mix(in srgb, var(--primary) 8%, var(--surface-2));
  outline: none;
}

.knowledge-upload-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--line));
  border-radius: 8px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 9%, var(--surface));
}

.upload-preview {
  display: grid;
  gap: 14px;
}

.preview-summary,
.preview-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.preview-summary,
.recommend-toolbar,
.preview-reasons {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
}

.preview-summary span,
.preview-reasons span,
.preview-sample > span,
.preview-form label > span,
.recommend-toolbar span {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.preview-form label {
  min-width: 0;
}

.preview-form .el-select {
  width: 100%;
}

.recommend-toolbar {
  justify-content: space-between;
  gap: 12px;
}

.preview-reasons p {
  margin: 7px 0 0;
  color: var(--text-soft);
}

.preview-sample pre {
  max-height: 240px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface-2);
  font-family: Consolas, 'Microsoft YaHei UI', monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1180px) {
  .knowledge-page-header {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .knowledge-page-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .knowledge-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .knowledge-management-page {
    overflow-y: auto;
  }

  .knowledge-page-header,
  .knowledge-grid,
  .knowledge-upload-type-options,
  .preview-summary,
  .preview-form {
    grid-template-columns: 1fr;
  }

  .knowledge-page-summary,
  .knowledge-page-actions,
  .knowledge-toolbar,
  .recommend-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .knowledge-page-actions,
  .knowledge-page-summary {
    grid-column: auto;
  }

  .knowledge-search-input {
    width: 100%;
  }

  .knowledge-collection-tabs {
    min-height: 52px;
  }

  .knowledge-workspace {
    min-height: 420px;
  }

  .knowledge-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
