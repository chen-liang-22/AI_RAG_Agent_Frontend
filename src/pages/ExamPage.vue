<script setup lang="ts">
// 对话式考试页：
// 1. 左侧选择向量库、文件、一级目录、轮数和题型；
// 2. 中间按聊天形式展示题目、用户答案和单题分析；
// 3. 右侧展示历史考试，可打开抽屉查看题目、答案和遗漏点。
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  History,
  LibraryBig,
  RefreshCw,
  Send,
  Sparkles,
  Target,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  answerExamSession,
  getExamSessionDetail,
  listExamSections,
  listExamSessions,
  listKnowledgeFiles,
  startExamSession,
  type ExamAnswerAnalysis,
  type ExamConversationQuestion,
  type ExamQuestionType,
  type ExamSectionResponse,
  type ExamSessionDetailResponse,
  type ExamSessionSummary,
  type KnowledgeFileResponse,
  type ModelMode,
} from '../api'

defineProps<{ themeMode: 'dark' | 'light' }>()

type ExamMessageRole = 'assistant' | 'user' | 'analysis'

// 中间聊天窗口里的消息模型，question 和 analysis 用来承载题目卡片和评分卡片。
interface ExamMessage {
  id: string
  role: ExamMessageRole
  content: string
  question?: ExamConversationQuestion
  analysis?: ExamAnswerAnalysis
}

// 页面加载状态：分别控制文件、目录、开始考试、提交答案、历史和详情的 loading。
const loadingFiles = ref(false)
const loadingSections = ref(false)
const starting = ref(false)
const submitting = ref(false)
const loadingHistory = ref(false)
const loadingDetail = ref(false)

// 题源和历史列表数据：知识文件决定可选向量库/文件，目录只展示第一层目录。
const knowledgeFiles = ref<KnowledgeFileResponse[]>([])
const sections = ref<ExamSectionResponse[]>([])
const histories = ref<ExamSessionSummary[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyKeyword = ref('')
const detailVisible = ref(false)
const selectedDetail = ref<ExamSessionDetailResponse | null>(null)

// 考试配置：用户可以指定向量库、文件、一级目录、轮数、模型档位和题型范围。
const selectedCollectionName = ref('agent')
const selectedDocumentId = ref('')
const selectedSectionPath = ref('')
const userId = ref('exam-user')
const roundCount = ref(5)
const modelMode = ref<ModelMode>('high')
const randomSeed = ref<number | null>(null)
const selectedQuestionTypes = ref<ExamQuestionType[]>([
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_answer',
  'fill_blank',
])

// 当前考试会话状态：activeSession 是会话摘要，currentQuestion 是当前待回答题目。
const activeSession = ref<ExamSessionSummary | null>(null)
const currentQuestion = ref<ExamConversationQuestion | null>(null)
const messages = ref<ExamMessage[]>([])
const examMessageList = ref<HTMLElement | null>(null)

// 答案输入状态：客观题使用选项，主观题和填空题使用文本框。
const textAnswer = ref('')
const selectedOption = ref('')
const selectedOptions = ref<string[]>([])

// 选择文件后反查文件对象，用于自动同步 collection_name。
const selectedDocument = computed(() => knowledgeFiles.value.find((item) => item.document_id === selectedDocumentId.value))

// 向量库下拉来自已入库文件，去重后展示。
const collectionOptions = computed(() => [...new Set(knowledgeFiles.value.map((item) => item.collection_name).filter(Boolean))])

// 进度条按已答题数计算，满分得分条直接使用后端累计分数。
const progressPercent = computed(() => {
  if (!activeSession.value || activeSession.value.round_count === 0) return 0
  return Math.round((activeSession.value.answered_count / activeSession.value.round_count) * 100)
})
const scorePercent = computed(() => Math.round(activeSession.value?.total_score || 0))
const isObjectiveChoice = computed(() => ['single_choice', 'multiple_choice', 'true_false'].includes(currentQuestion.value?.question_type || ''))
const isMultipleChoice = computed(() => currentQuestion.value?.question_type === 'multiple_choice')

// 前端展示的题型枚举，值必须和后端 ExamQuestionType 保持一致。
const questionTypeOptions: Array<{ label: string; value: ExamQuestionType }> = [
  { label: '单选', value: 'single_choice' },
  { label: '多选', value: 'multiple_choice' },
  { label: '判断', value: 'true_false' },
  { label: '简答', value: 'short_answer' },
  { label: '填空', value: 'fill_blank' },
]

// 刷新题源文件列表，首次进入页面时默认选中第一个已入库文件。
async function refreshKnowledgeFiles() {
  loadingFiles.value = true
  try {
    knowledgeFiles.value = await listKnowledgeFiles()
    if (!selectedDocumentId.value && knowledgeFiles.value.length > 0) {
      selectedDocumentId.value = knowledgeFiles.value[0].document_id
      selectedCollectionName.value = knowledgeFiles.value[0].collection_name
    }
  } finally {
    loadingFiles.value = false
  }
}

// 按当前向量库和文件读取考试目录，后端只返回第一层目录。
async function refreshSections() {
  selectedSectionPath.value = ''
  if (!selectedCollectionName.value) return
  loadingSections.value = true
  try {
    const response = await listExamSections(selectedCollectionName.value, selectedDocumentId.value || null)
    sections.value = response.sections
  } catch (error) {
    sections.value = []
    ElMessage.warning(error instanceof Error ? error.message : '目录读取失败')
  } finally {
    loadingSections.value = false
  }
}

// 刷新右侧历史记录，每页固定 10 条。
async function refreshHistory() {
  loadingHistory.value = true
  try {
    const response = await listExamSessions(historyPage.value, 10, userId.value, historyKeyword.value)
    histories.value = response.items
    historyTotal.value = response.total
  } finally {
    loadingHistory.value = false
  }
}

// 把后端返回的题目追加成一条助手消息。
function appendAssistantQuestion(question: ExamConversationQuestion) {
  messages.value.push({
    id: `assistant-${question.exam_question_id}`,
    role: 'assistant',
    content: question.prompt,
    question,
  })
}

// 消息新增后滚到底部，保证用户总能看到最新题目或分析。
async function scrollExamMessagesToBottom() {
  await nextTick()
  if (examMessageList.value) {
    examMessageList.value.scrollTop = examMessageList.value.scrollHeight
  }
}

// 每提交一题或开始新考试后清空答案输入。
function resetAnswerState() {
  textAnswer.value = ''
  selectedOption.value = ''
  selectedOptions.value = []
}

// 生成默认测评名称，用户可以在开始前修改。
function defaultExamTitle() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `知识测评 ${month}-${day} ${hour}:${minute}`
}

// 开始考试：先输入本场测评名称，再由后端随机抽题并创建可追溯的考试会话。
async function startExam() {
  if (!selectedCollectionName.value) {
    ElMessage.warning('请先选择向量库')
    return
  }
  if (selectedQuestionTypes.value.length === 0) {
    ElMessage.warning('请至少选择一种题型')
    return
  }

  starting.value = true
  try {
    const { value } = await ElMessageBox.prompt('请输入本场测评名称，历史记录会显示这个名称。', '开始测评', {
      confirmButtonText: '开始',
      cancelButtonText: '取消',
      inputValue: defaultExamTitle(),
      inputPlaceholder: '例如：Java 集合专项测评',
      inputPattern: /\S+/,
      inputErrorMessage: '测评名称不能为空',
    })
    const examTitle = String(value || '').trim()
    if (!examTitle) {
      ElMessage.warning('测评名称不能为空')
      return
    }
    const response = await startExamSession({
      title: examTitle,
      collection_name: selectedCollectionName.value,
      document_id: selectedDocumentId.value || null,
      section_path: selectedSectionPath.value || null,
      user_id: userId.value,
      round_count: roundCount.value,
      question_types: selectedQuestionTypes.value,
      model_mode: modelMode.value,
      seed: randomSeed.value,
    })
    // 新会话开始后重建聊天窗口，只保留本场考试的消息。
    activeSession.value = response.session
    currentQuestion.value = response.current_question
    messages.value = [
      {
        id: `start-${response.session.session_id}`,
        role: 'assistant',
        content: `《${response.session.title}》测评开始，共 ${response.session.round_count} 轮，满分 100 分。`,
      },
    ]
    appendAssistantQuestion(response.current_question)
    resetAnswerState()
    await scrollExamMessagesToBottom()
    await refreshHistory()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '考试启动失败')
  } finally {
    starting.value = false
  }
}

// 按题型读取当前答案，多选题返回数组，其余题型返回字符串。
function currentAnswerValue() {
  if (!currentQuestion.value) return ''
  if (isObjectiveChoice.value) {
    return isMultipleChoice.value ? selectedOptions.value : selectedOption.value
  }
  return textAnswer.value.trim()
}

// 提交当前轮答案：后端保存答案、调用模型阅卷，并返回下一题或结束状态。
async function submitAnswer() {
  if (!activeSession.value || !currentQuestion.value) {
    ElMessage.warning('请先开始考试')
    return
  }
  const answer = currentAnswerValue()
  if ((Array.isArray(answer) && answer.length === 0) || (!Array.isArray(answer) && !answer)) {
    ElMessage.warning('请先作答')
    return
  }

  submitting.value = true
  try {
    messages.value.push({
      id: `user-${currentQuestion.value.exam_question_id}`,
      role: 'user',
      content: Array.isArray(answer) ? answer.join('、') : answer,
    })
    const response = await answerExamSession(activeSession.value.session_id, answer)
    activeSession.value = response.session
    messages.value.push({
      id: `analysis-${response.answered_question.exam_question_id}`,
      role: 'analysis',
      content: response.analysis.comment,
      analysis: response.analysis,
    })
    currentQuestion.value = response.next_question || null
    resetAnswerState()
    if (response.next_question) {
      appendAssistantQuestion(response.next_question)
    } else {
      messages.value.push({
        id: `finish-${response.session.session_id}`,
        role: 'assistant',
        content: `测评完成，最终得分 ${response.session.total_score.toFixed(1)} / 100。`,
      })
      await refreshHistory()
    }
    await scrollExamMessagesToBottom()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '答案提交失败')
  } finally {
    submitting.value = false
  }
}

// 把后端题型编码转换成页面中文标签。
function questionTypeLabel(type: ExamQuestionType | string) {
  return questionTypeOptions.find((item) => item.value === type)?.label || type
}

// 展示题目来源，便于用户知道题目来自哪个文件、目录和页码。
function sourceText(question: ExamConversationQuestion) {
  return [
    question.source.filename,
    question.source.section_path,
    question.source.source_page ? `第 ${question.source.source_page} 页` : '',
  ].filter(Boolean).join(' / ') || '题库来源'
}

// 正确答案可能是字符串或数组，这里统一转成适合展示的文本。
function answerText(value: unknown) {
  if (Array.isArray(value)) return value.join('、')
  if (value === null || value === undefined) return ''
  return String(value)
}

// 分析列表为空时展示“无”，避免页面出现空白块。
function safeList(items: string[]) {
  return items.length > 0 ? items : ['无']
}

// 打开历史详情抽屉，展示完整题目、用户答案和分析结果。
async function openHistoryDetail(session: ExamSessionSummary) {
  loadingDetail.value = true
  detailVisible.value = true
  try {
    selectedDetail.value = await getExamSessionDetail(session.session_id)
  } finally {
    loadingDetail.value = false
  }
}

// 切换文件时同步向量库，并重新读取该文件下的一级目录。
watch(selectedDocumentId, () => {
  if (selectedDocument.value?.collection_name) {
    selectedCollectionName.value = selectedDocument.value.collection_name
  }
  void refreshSections()
})

// 手动切换向量库后重新读取目录。
watch(selectedCollectionName, () => {
  void refreshSections()
})

// 消息数量变化时自动滚动到底部。
watch(
  () => messages.value.length,
  () => {
    void scrollExamMessagesToBottom()
  },
)

// 页面初始化时同时加载题源和历史记录。
onMounted(async () => {
  await Promise.all([
    refreshKnowledgeFiles(),
    refreshHistory(),
  ])
})
</script>

<template>
  <div class="exam-page exam-chat-page">
    <header class="page-hero exam-hero">
      <div>
        <span class="page-kicker"><ClipboardCheck :size="16" /> 对话式考试</span>
        <h2>知识掌握度随机问答</h2>
        <p>选择向量库、文件和目录后随机抽题，按轮对话作答，系统保存题目、答案、得分和遗漏点分析。</p>
      </div>
      <div class="exam-hero-actions">
        <el-button class="tech-button" :icon="RefreshCw" :loading="loadingFiles" @click="refreshKnowledgeFiles">刷新题源</el-button>
        <el-button class="tech-button primary" :icon="Sparkles" :loading="starting" @click="startExam">开始测评</el-button>
      </div>
    </header>

    <section class="exam-conversation-layout">
      <aside class="exam-control-panel">
        <div class="panel-title"><LibraryBig :size="16" /> 题源设置</div>
        <label>
          <span>向量库</span>
          <el-select v-model="selectedCollectionName" filterable allow-create placeholder="选择向量库">
            <el-option v-for="name in collectionOptions" :key="name" :label="name" :value="name" />
          </el-select>
        </label>
        <label>
          <span>文件</span>
          <el-select v-model="selectedDocumentId" clearable filterable placeholder="全部文件">
            <el-option
              v-for="file in knowledgeFiles.filter((item) => item.collection_name === selectedCollectionName)"
              :key="file.document_id"
              :label="`${file.filename} / ${file.document_type} / ${file.split_strategy}`"
              :value="file.document_id"
            />
          </el-select>
        </label>
        <label>
          <span>目录</span>
          <el-select v-model="selectedSectionPath" clearable filterable :loading="loadingSections" placeholder="全部目录">
            <el-option
              v-for="section in sections"
              :key="section.section_path"
              :label="`${section.section_path}（${section.question_count}题）`"
              :value="section.section_path"
            />
          </el-select>
        </label>

        <div class="exam-control-grid">
          <label>
            <span>轮数</span>
            <el-input-number v-model="roundCount" :min="1" :max="50" />
          </label>
          <label>
            <span>随机种子</span>
            <el-input-number v-model="randomSeed" :min="1" :max="999999" placeholder="可不填" />
          </label>
        </div>
        <label>
          <span>分析模型</span>
          <el-select v-model="modelMode">
            <el-option label="高质量" value="high" />
            <el-option label="均衡" value="medium" />
            <el-option label="低延迟" value="low" />
          </el-select>
        </label>
        <label>
          <span>题型</span>
          <el-checkbox-group v-model="selectedQuestionTypes" class="question-type-grid">
            <el-checkbox-button v-for="item in questionTypeOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-checkbox-button>
          </el-checkbox-group>
        </label>
      </aside>

      <section class="exam-chat-panel">
        <section class="exam-score-strip">
          <span><Target :size="16" /> 进度 {{ activeSession?.answered_count || 0 }}/{{ activeSession?.round_count || roundCount }}</span>
          <span><CheckCircle2 :size="16" /> 得分 {{ activeSession?.total_score?.toFixed(1) || '0.0' }}/100</span>
          <el-progress :percentage="progressPercent" :stroke-width="10" />
          <el-progress :percentage="scorePercent" :stroke-width="10" status="success" />
        </section>

        <section ref="examMessageList" class="exam-chat-window">
          <article v-for="message in messages" :key="message.id" class="exam-chat-message" :class="message.role">
            <span class="exam-chat-avatar">
              <Bot v-if="message.role !== 'user'" :size="16" />
              <span v-else>我</span>
            </span>
            <div class="exam-chat-bubble">
              <div v-if="message.question" class="exam-question-meta">
                <b>第 {{ message.question.round_no }} 轮 · {{ questionTypeLabel(message.question.question_type) }}</b>
                <em>{{ sourceText(message.question) }}</em>
              </div>
              <p>{{ message.content }}</p>
              <div v-if="message.question?.options.length" class="exam-option-preview">
                <span v-for="option in message.question.options" :key="option">{{ option }}</span>
              </div>
              <div v-if="message.analysis" class="exam-analysis-card">
                <strong>{{ message.analysis.score.toFixed(1) }}/{{ message.analysis.max_score.toFixed(1) }} 分</strong>
                <p>正确答案：{{ answerText(message.analysis.correct_answer) }}</p>
                <div class="exam-analysis-grid">
                  <div><b>命中</b><span>{{ safeList(message.analysis.hit_points).join('、') }}</span></div>
                  <div><b>遗漏</b><span>{{ safeList(message.analysis.missing_points).join('、') }}</span></div>
                  <div><b>错误</b><span>{{ safeList(message.analysis.wrong_points).join('、') }}</span></div>
                </div>
              </div>
            </div>
          </article>
          <div v-if="messages.length === 0" class="empty-paper">
            <FileQuestion :size="30" />
            <strong>还没有开始测评</strong>
            <span>设置题源、轮数和题型后点击“开始测评”。</span>
          </div>
        </section>

        <footer class="exam-answer-bar">
          <template v-if="currentQuestion">
            <el-checkbox-group v-if="isMultipleChoice" v-model="selectedOptions" class="answer-options">
              <el-checkbox-button v-for="option in currentQuestion.options" :key="option" :value="option">
                {{ option }}
              </el-checkbox-button>
            </el-checkbox-group>
            <el-radio-group v-else-if="isObjectiveChoice" v-model="selectedOption" class="answer-options">
              <el-radio-button v-for="option in currentQuestion.options" :key="option" :value="option">
                {{ option }}
              </el-radio-button>
            </el-radio-group>
            <el-input
              v-else
              v-model="textAnswer"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              placeholder="输入你的答案"
              @keydown.ctrl.enter.prevent="submitAnswer"
            />
            <el-button class="tech-button primary" :icon="Send" :loading="submitting" @click="submitAnswer">提交答案</el-button>
          </template>
          <template v-else>
            <span class="exam-answer-placeholder">当前没有待回答题目。</span>
          </template>
        </footer>
      </section>

      <aside class="exam-history-panel">
        <div class="panel-title panel-title-between">
          <span><History :size="16" /> 历史记录</span>
          <el-button text :loading="loadingHistory" @click="refreshHistory">刷新</el-button>
        </div>
        <el-input v-model="historyKeyword" placeholder="搜索文件/目录" clearable @change="refreshHistory" />
        <div class="exam-history-list" v-loading="loadingHistory">
          <button v-for="item in histories" :key="item.session_id" type="button" @click="openHistoryDetail(item)">
            <strong>{{ item.title }}</strong>
            <span>{{ item.filename || item.collection_name }}</span>
            <em>{{ item.total_score.toFixed(1) }}/100 · {{ item.answered_count }}/{{ item.round_count }}</em>
          </button>
          <div v-if="histories.length === 0" class="empty-history">暂无考试记录</div>
        </div>
        <el-pagination
          v-model:current-page="historyPage"
          size="small"
          layout="prev, pager, next"
          :page-size="10"
          :total="historyTotal"
          @current-change="refreshHistory"
        />
      </aside>
    </section>

    <el-drawer v-model="detailVisible" title="考试详情" size="720px" class="exam-detail-drawer">
      <div v-loading="loadingDetail" class="exam-detail-body">
        <template v-if="selectedDetail">
          <section class="exam-detail-summary">
            <strong>{{ selectedDetail.session.title }}</strong>
            <span>{{ selectedDetail.session.total_score.toFixed(1) }}/100 分</span>
            <em>{{ selectedDetail.session.filename || selectedDetail.session.collection_name }}</em>
          </section>
          <article v-for="record in selectedDetail.questions" :key="record.question.exam_question_id" class="exam-detail-question">
            <div>
              <strong>第 {{ record.question.round_no }} 轮 · {{ questionTypeLabel(record.question.question_type) }}</strong>
              <em>{{ sourceText(record.question) }}</em>
            </div>
            <p>{{ record.question.prompt }}</p>
            <div v-if="record.question.options.length" class="exam-option-preview">
              <span v-for="option in record.question.options" :key="option">{{ option }}</span>
            </div>
            <p class="detail-user-answer">用户回答：{{ record.user_answer || '未作答' }}</p>
            <div v-if="record.analysis" class="exam-analysis-card">
              <strong>{{ record.analysis.score.toFixed(1) }}/{{ record.analysis.max_score.toFixed(1) }} 分</strong>
              <p>正确答案：{{ answerText(record.analysis.correct_answer) }}</p>
              <p>遗漏点：{{ safeList(record.analysis.missing_points).join('、') }}</p>
              <p>点评：{{ record.analysis.comment || '暂无点评' }}</p>
            </div>
          </article>
        </template>
      </div>
    </el-drawer>
  </div>
</template>
