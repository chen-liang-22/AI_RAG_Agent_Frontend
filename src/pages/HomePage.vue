<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Activity, Boxes, BrainCircuit, Clock3, DatabaseZap, FileText, Network, RefreshCw, Route, ShieldCheck } from 'lucide-vue-next'
import { API_BASE_URL, fetchHealth, listConversations, listDictionaries, listKnowledgeFiles, type ConversationSummaryResponse, type DictionaryGroupResponse, type HealthResponse, type KnowledgeFileResponse } from '../api'

defineProps<{ themeMode: 'dark' | 'light' }>()

const loading = ref(false)
const health = ref<HealthResponse | null>(null)
const knowledgeFiles = ref<KnowledgeFileResponse[]>([])
const dictionaries = ref<DictionaryGroupResponse[]>([])
const conversations = ref<ConversationSummaryResponse[]>([])
const conversationTotal = ref(0)

const indexedCount = computed(() => knowledgeFiles.value.filter((item) => item.status === 'indexed').length)
const collectionCount = computed(() => new Set([...(health.value?.collections || []), ...knowledgeFiles.value.map((item) => item.collection_name)]).size)
const dictionaryItemCount = computed(() => dictionaries.value.reduce((total, group) => total + countItems(group.items), 0))
const latestConversation = computed(() => conversations.value[0])

const cockpitCards = computed(() => [
  { title: '星图服务状态', value: serviceStatusLabel(health.value?.status), detail: `Qdrant ${serviceStatusLabel(health.value?.qdrant)}`, icon: ShieldCheck, tone: health.value?.status === 'ok' ? 'good' : 'warn' },
  { title: '知识矩阵', value: `${indexedCount.value}/${knowledgeFiles.value.length}`, detail: '已索引 / 文件总数', icon: DatabaseZap, tone: 'blue' },
  { title: '多库航道', value: collectionCount.value || 0, detail: '可用知识库 Collection', icon: Boxes, tone: 'cyan' },
  { title: '字典引擎', value: dictionaries.value.length, detail: `${dictionaryItemCount.value} 个字典项`, icon: FileText, tone: 'violet' },
  { title: '会话星轨', value: conversationTotal.value, detail: latestConversation.value?.title || '暂无最近会话', icon: Clock3, tone: 'amber' },
  { title: '问答链路', value: 'Direct RAG', detail: 'Planner -> Qdrant -> LLM', icon: Route, tone: 'green' },
  { title: '接口枢纽', value: API_BASE_URL, detail: '前端当前 API Base URL', icon: Network, tone: 'slate' },
])

function countItems(items: DictionaryGroupResponse['items']): number {
  return items.reduce((total, item) => total + 1 + countItems(item.children || []), 0)
}

function serviceStatusLabel(status?: string) {
  if (status === 'ok') return '正常'
  if (status === 'degraded') return '降级'
  if (status === 'unavailable') return '不可用'
  return '未知'
}

function formatDateTime(value?: string | null) {
  if (!value) return '暂无'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function refreshDashboard() {
  loading.value = true
  try {
    const [healthData, filesData, dictionaryData, conversationData] = await Promise.all([
      fetchHealth(),
      listKnowledgeFiles(),
      listDictionaries(),
      listConversations(1, 5),
    ])
    health.value = healthData
    knowledgeFiles.value = filesData
    dictionaries.value = dictionaryData
    conversations.value = conversationData.items
    conversationTotal.value = conversationData.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refreshDashboard()
})
</script>

<template>
  <div v-loading="loading" class="dashboard-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><Activity :size="16" /> 系统驾驶舱</span>
        <h2>知识服务总览</h2>
        <p>集中查看服务状态、知识库、字典、会话与接口配置。</p>
      </div>
      <el-button class="tech-button" :icon="RefreshCw" :loading="loading" @click="refreshDashboard">刷新状态</el-button>
    </header>

    <section class="cockpit-grid">
      <article v-for="card in cockpitCards" :key="card.title" class="cockpit-card" :class="`tone-${card.tone}`">
        <span class="cockpit-icon"><component :is="card.icon" :size="22" /></span>
        <div>
          <strong>{{ card.value }}</strong>
          <h3>{{ card.title }}</h3>
          <p>{{ card.detail }}</p>
        </div>
      </article>
    </section>

    <section class="dashboard-panels">
      <article class="dashboard-panel">
        <div class="panel-title"><DatabaseZap :size="18" /><span>知识库概览</span></div>
        <div class="data-table-lite">
          <div v-for="file in knowledgeFiles.slice(0, 6)" :key="file.document_id">
            <span>{{ file.filename }}</span><em>{{ file.collection_name }} / {{ file.status }}</em>
          </div>
          <p v-if="knowledgeFiles.length === 0">暂无知识库文件</p>
        </div>
      </article>
      <article class="dashboard-panel">
        <div class="panel-title"><BrainCircuit :size="18" /><span>工作流说明</span></div>
        <div class="flow-line"><span>用户问题</span><span>Query Planner</span><span>Qdrant</span><span>LLM 回答</span></div>
        <p class="panel-note">普通知识问答默认走 Direct RAG，减少工具判断带来的额外耗时。</p>
      </article>
      <article class="dashboard-panel">
        <div class="panel-title"><Clock3 :size="18" /><span>最近会话</span></div>
        <div class="data-table-lite">
          <div v-for="conversation in conversations" :key="conversation.conversation_id">
            <span>{{ conversation.title || '未命名会话' }}</span><em>{{ formatDateTime(conversation.last_message_at || conversation.updated_at) }}</em>
          </div>
          <p v-if="conversations.length === 0">暂无聊天记录</p>
        </div>
      </article>
    </section>
  </div>
</template>
