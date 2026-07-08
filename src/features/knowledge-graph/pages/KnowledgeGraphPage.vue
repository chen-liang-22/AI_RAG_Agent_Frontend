<script setup lang="ts">
// 知识图谱驾驶舱：
// 1. 读取 Neo4j 健康状态，确认后端是否真的连上图数据库；
// 2. 展示节点、关系、标签和关系类型的统计，方便判断文件是否写入图谱；
// 3. 支持按 document_id 查询单个文件的 Document/Chunk/Entity 关系。
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  Boxes,
  DatabaseZap,
  FileSearch,
  GitBranch,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import {
  fetchGraphDocument,
  fetchGraphDocuments,
  fetchGraphHealth,
  fetchGraphOverview,
  initGraphSchema,
  rebuildGraphDocument,
  type GraphCountItem,
  type GraphDocumentSummary,
  type GraphDocumentResponse,
  type GraphHealthResponse,
  type GraphNodeItem,
  type GraphOverviewResponse,
} from '../../../shared/api'

defineProps<{ themeMode: 'dark' | 'light' }>()

const loading = ref(false) // 页面整体刷新状态
const initializing = ref(false) // 初始化 Neo4j 约束和索引按钮 loading
const documentListLoading = ref(false) // 文件名模糊查询 loading
const documentLoading = ref(false) // 单文件图谱查询 loading
const rebuilding = ref(false) // 单文件图谱重建 loading
const filenameKeyword = ref('') // 文件名称关键词
const documentIdInput = ref('') // 用户输入的 document_id
const health = ref<GraphHealthResponse | null>(null) // Neo4j 健康检查结果
const overview = ref<GraphOverviewResponse | null>(null) // 图谱全局概览
const graphDocuments = ref<GraphDocumentSummary[]>([]) // 已进入图谱的文件列表
const documentGraph = ref<GraphDocumentResponse | null>(null) // 单个文件图谱详情

const healthTone = computed(() => {
  if (health.value?.status === 'ok') return 'good'
  if (health.value?.status === 'disabled') return 'muted'
  return 'danger'
})

const healthLabel = computed(() => {
  if (!health.value) return '未检测'
  if (health.value.status === 'ok') return '连接正常'
  if (health.value.status === 'disabled') return '未启用'
  return '不可用'
})

const labelStats = computed(() => normalizeStats(overview.value?.labels || [], 'label'))
const relationshipStats = computed(() => normalizeStats(overview.value?.relationship_types || [], 'type'))
const graphNodeRows = computed(() => (documentGraph.value?.nodes || []).map((node, index) => ({
  id: nodeId(node, index),
  nodeType: graphLabelText(node.label),
  name: nodeName(node),
  preview: nodePreview(node),
  rawType: node.label,
})))
const graphRelationshipRows = computed(() => (documentGraph.value?.relationships || []).map((relationship, index) => ({
  id: `${relationship.type}-${index}`,
  relationType: relationshipTypeText(relationship.type),
  source: relationship.source,
  target: relationship.target,
})))

const summaryCards = computed(() => [
  {
    label: 'Neo4j 状态',
    value: healthLabel.value,
    note: health.value?.message || '等待检测',
    icon: ShieldCheck,
    tone: healthTone.value,
  },
  {
    label: '节点总数',
    value: String(overview.value?.node_count ?? 0),
    note: 'Document / Chunk / Entity',
    icon: Network,
    tone: 'primary',
  },
  {
    label: '关系总数',
    value: String(overview.value?.relationship_count ?? 0),
    note: 'HAS_CHUNK / MENTIONS',
    icon: GitBranch,
    tone: 'cyan',
  },
  {
    label: '标签类型',
    value: String(labelStats.value.length),
    note: '当前图谱节点分类',
    icon: Boxes,
    tone: 'amber',
  },
])

async function refreshAll() {
  loading.value = true
  try {
    const [healthResponse, overviewResponse] = await Promise.all([
      fetchGraphHealth(),
      fetchGraphOverview(),
    ])
    health.value = healthResponse
    overview.value = overviewResponse
    graphDocuments.value = overviewResponse.documents || []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识图谱概览读取失败')
  } finally {
    loading.value = false
  }
}

async function initializeSchema() {
  initializing.value = true
  try {
    health.value = await initGraphSchema()
    ElMessage.success(health.value.message || '知识图谱结构已初始化')
    await refreshAll()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识图谱初始化失败')
  } finally {
    initializing.value = false
  }
}

async function searchGraphDocuments() {
  documentListLoading.value = true
  try {
    const response = await fetchGraphDocuments(filenameKeyword.value, 30)
    graphDocuments.value = response.documents || []
    if (!graphDocuments.value.length) {
      ElMessage.warning(response.message || '未查到匹配的图谱文件')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件名查询失败')
  } finally {
    documentListLoading.value = false
  }
}

async function selectGraphDocument(row: GraphDocumentSummary) {
  documentIdInput.value = row.document_id
  await queryDocumentGraph()
}

async function queryDocumentGraph() {
  const documentId = documentIdInput.value.trim()
  if (!documentId) {
    ElMessage.warning('请输入文件编号 document_id')
    return
  }

  documentLoading.value = true
  try {
    documentGraph.value = await fetchGraphDocument(documentId)
    if (documentGraph.value.status !== 'ok') {
      ElMessage.warning(documentGraph.value.message || '未查到该文件的图谱数据')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件图谱查询失败')
  } finally {
    documentLoading.value = false
  }
}

async function rebuildDocumentGraphFromQdrant() {
  const documentId = documentIdInput.value.trim()
  if (!documentId) {
    ElMessage.warning('请输入需要重建的文件编号')
    return
  }

  rebuilding.value = true
  try {
    documentGraph.value = await rebuildGraphDocument(documentId)
    await refreshAll()
    ElMessage.success('文件图谱已按 Qdrant 切片重建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件图谱重建失败')
  } finally {
    rebuilding.value = false
  }
}

function normalizeStats(items: GraphCountItem[], key: 'label' | 'type') {
  return items.map((item) => ({
    name: String(item[key] || '未知'),
    label: key === 'label' ? graphLabelText(String(item[key] || '')) : relationshipTypeText(String(item[key] || '')),
    count: Number(item.count || 0),
  }))
}

function graphLabelText(label: string) {
  if (label === 'Document') return '文件节点'
  if (label === 'Chunk') return '切片节点'
  if (label === 'Entity') return '实体节点'
  return label || '未知节点'
}

function relationshipTypeText(type: string) {
  if (type === 'HAS_CHUNK') return '文件包含切片'
  if (type === 'MENTIONS') return '切片提到实体'
  if (type === 'RELATED_TO') return '实体相关'
  return type || '未知关系'
}

function nodeId(node: GraphNodeItem, index: number) {
  const properties = node.properties || {}
  return String(properties.document_id || properties.chunk_id || properties.normalized_name || `${node.label}-${index}`)
}

function nodeName(node: GraphNodeItem) {
  const properties = node.properties || {}
  return String(properties.filename || properties.name || properties.chunk_id || properties.document_id || '未命名节点')
}

function nodePreview(node: GraphNodeItem) {
  const properties = node.properties || {}
  return String(properties.text_preview || properties.collection_name || properties.type || properties.source || '')
}

function sourceText(source: string) {
  if (source === 'training') return '销售训练'
  if (source === 'knowledge') return '知识库'
  return source || '未知'
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <main class="knowledge-graph-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><Network :size="14" /> Neo4j 关系网络</span>
        <h2>知识图谱驾驶舱</h2>
        <p>查看文件、切片、实体之间的结构化关系，确认上传资料是否已经进入 Neo4j。</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button class="tech-button" :icon="RefreshCw" :loading="loading" @click="refreshAll">刷新概览</el-button>
        <el-button class="tech-button primary" :icon="DatabaseZap" :loading="initializing" @click="initializeSchema">初始化图谱结构</el-button>
      </div>
    </header>

    <section class="graph-summary-grid">
      <article v-for="item in summaryCards" :key="item.label" class="graph-summary-card" :class="`tone-${item.tone}`">
        <span><component :is="item.icon" :size="18" /></span>
        <div>
          <em>{{ item.label }}</em>
          <strong>{{ item.value }}</strong>
          <small :title="item.note">{{ item.note }}</small>
        </div>
      </article>
    </section>

    <section class="graph-workbench">
      <article class="graph-panel">
        <div class="graph-panel-title">
          <span><Activity :size="16" /> 节点分布</span>
          <em>{{ overview?.status || 'waiting' }}</em>
        </div>
        <div v-if="labelStats.length" class="graph-stat-list">
          <div v-for="item in labelStats" :key="item.name" class="graph-stat-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
        <el-empty v-else description="暂无节点统计" :image-size="70" />
      </article>

      <article class="graph-panel">
        <div class="graph-panel-title">
          <span><GitBranch :size="16" /> 关系分布</span>
          <em>Relation</em>
        </div>
        <div v-if="relationshipStats.length" class="graph-stat-list">
          <div v-for="item in relationshipStats" :key="item.name" class="graph-stat-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
        <el-empty v-else description="暂无关系统计" :image-size="70" />
      </article>

      <article class="graph-panel graph-document-panel">
        <div class="graph-panel-title">
          <span><FileSearch :size="16" /> 文件图谱查询</span>
          <em>文件名</em>
        </div>
        <div class="graph-document-search">
          <el-input
            v-model="filenameKeyword"
            clearable
            placeholder="输入文件名称关键词"
            @keyup.enter="searchGraphDocuments"
          />
          <el-button class="tech-button primary" :icon="Search" :loading="documentListLoading" @click="searchGraphDocuments">查文件</el-button>
          <el-input
            v-model="documentIdInput"
            clearable
            placeholder="或输入 document_id 精准查询"
            @keyup.enter="queryDocumentGraph"
          />
          <el-button class="tech-button" :icon="Search" :loading="documentLoading" @click="queryDocumentGraph">查图谱</el-button>
          <el-button class="tech-button" :icon="RotateCcw" :loading="rebuilding" @click="rebuildDocumentGraphFromQdrant">重建</el-button>
        </div>
        <div class="graph-document-meta">
          <span>文件 {{ graphDocuments.length }}</span>
          <span>节点 {{ graphNodeRows.length }}</span>
          <span>关系 {{ graphRelationshipRows.length }}</span>
          <span>{{ documentGraph?.message || documentGraph?.status || '可按文件名查询后点击文件' }}</span>
        </div>
      </article>
    </section>

    <section class="graph-detail-grid">
      <article class="graph-panel graph-table-panel">
        <div class="graph-panel-title">
          <span><FileSearch :size="16" /> 最近图谱文件</span>
          <em>{{ graphDocuments.length }} 个</em>
        </div>
        <el-table
          :data="graphDocuments"
          height="100%"
          class="graph-table"
          empty-text="暂无图谱文件"
          highlight-current-row
          @row-click="selectGraphDocument"
        >
          <el-table-column prop="filename" label="文件名称" min-width="220" show-overflow-tooltip />
          <el-table-column label="来源" width="100">
            <template #default="{ row }">{{ sourceText(row.source) }}</template>
          </el-table-column>
          <el-table-column prop="chunk_count" label="切片" width="78" />
          <el-table-column prop="document_id" label="document_id" min-width="160" show-overflow-tooltip />
        </el-table>
      </article>

      <article class="graph-panel graph-table-panel">
        <div class="graph-panel-title">
          <span><Network :size="16" /> 图谱节点</span>
          <em>{{ graphNodeRows.length }} 个</em>
        </div>
        <el-table :data="graphNodeRows" height="100%" class="graph-table" empty-text="暂无节点">
          <el-table-column prop="nodeType" label="类型" width="120" />
          <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="preview" label="摘要" min-width="260" show-overflow-tooltip />
        </el-table>
      </article>

      <article class="graph-panel graph-table-panel">
        <div class="graph-panel-title">
          <span><GitBranch :size="16" /> 图谱关系</span>
          <em>{{ graphRelationshipRows.length }} 条</em>
        </div>
        <el-table :data="graphRelationshipRows" height="100%" class="graph-table" empty-text="暂无关系">
          <el-table-column prop="relationType" label="关系" width="140" />
          <el-table-column prop="source" label="起点" min-width="190" show-overflow-tooltip />
          <el-table-column prop="target" label="终点" min-width="190" show-overflow-tooltip />
        </el-table>
      </article>
    </section>
  </main>
</template>

<style scoped>
.knowledge-graph-page {
  display: grid;
  grid-template-rows: auto auto minmax(180px, .7fr) minmax(260px, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.graph-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.graph-summary-card,
.graph-panel {
  border: 1px solid var(--line);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent, var(--primary)) 10%, transparent), transparent 46%),
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 95%, transparent), color-mix(in srgb, var(--surface-2) 94%, transparent));
  box-shadow: var(--shadow-sm);
}

.graph-summary-card {
  --accent: var(--primary);
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 96px;
  border-radius: 16px;
  padding: 14px;
  overflow: hidden;
}

.graph-summary-card.tone-good { --accent: var(--green); }
.graph-summary-card.tone-muted { --accent: var(--text-muted); }
.graph-summary-card.tone-danger { --accent: var(--danger); }
.graph-summary-card.tone-primary { --accent: var(--primary); }
.graph-summary-card.tone-cyan { --accent: var(--cyan); }
.graph-summary-card.tone-amber { --accent: var(--amber); }

.graph-summary-card > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 62%, var(--cyan)));
  box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 28%, transparent);
}

.graph-summary-card div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.graph-summary-card em,
.graph-summary-card small {
  overflow: hidden;
  color: var(--text-muted);
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-summary-card strong {
  overflow: hidden;
  color: var(--text);
  font-size: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(320px, 1.25fr);
  gap: 12px;
  min-height: 0;
}

.graph-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  border-radius: 18px;
  padding: 14px;
  overflow: hidden;
}

.graph-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.graph-panel-title span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text);
  font-weight: 800;
}

.graph-panel-title em {
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--cyan) 32%, var(--line));
  border-radius: 999px;
  padding: 4px 8px;
  color: color-mix(in srgb, var(--text) 68%, var(--cyan));
  background: color-mix(in srgb, var(--cyan) 10%, transparent);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.graph-stat-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.graph-stat-row,
.graph-document-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--line) 70%, var(--cyan) 30%);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
}

.graph-stat-row {
  min-height: 42px;
  padding: 8px 10px;
}

.graph-stat-row span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-soft);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-stat-row strong {
  color: var(--text);
  font-size: 18px;
}

.graph-document-panel {
  grid-template-rows: auto auto auto;
}

.graph-document-search {
  display: grid;
  grid-template-columns: minmax(150px, .9fr) auto minmax(180px, 1fr) auto auto;
  gap: 8px;
  align-items: center;
}

.graph-document-meta {
  justify-content: flex-start;
  min-height: 42px;
  padding: 8px 10px;
  color: var(--text-soft);
  font-size: 13px;
}

.graph-document-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-detail-grid {
  display: grid;
  grid-template-columns: minmax(260px, .86fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.graph-table-panel {
  grid-template-rows: auto minmax(0, 1fr);
}

.graph-table {
  min-height: 0;
  color: var(--text);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: color-mix(in srgb, var(--surface-2) 86%, transparent);
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--primary) 10%, transparent);
  --el-table-border-color: var(--line);
  --el-table-text-color: var(--text);
  --el-table-header-text-color: var(--text-soft);
}

@media (max-width: 1180px) {
  .knowledge-graph-page {
    overflow: auto;
  }

  .graph-summary-grid,
  .graph-workbench,
  .graph-detail-grid {
    grid-template-columns: 1fr;
  }

  .graph-document-search {
    grid-template-columns: 1fr;
  }

  .graph-table-panel {
    min-height: 320px;
  }
}
</style>
