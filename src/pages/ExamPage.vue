<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ClipboardCheck, FileQuestion, RefreshCw, Sparkles } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { API_BASE_URL, listKnowledgeFiles, previewKnowledgeDocument, sendChat, type KnowledgeFileResponse, type ModelMode } from '../api'

defineProps<{ themeMode: 'dark' | 'light' }>()

interface ExamQuestion {
  id: string
  question: string
  referenceAnswer: string
  score: number
  userAnswer: string
  grading?: string
}

const loading = ref(false)
const generating = ref(false)
const grading = ref(false)
const knowledgeFiles = ref<KnowledgeFileResponse[]>([])
const selectedDocumentId = ref('')
const questionCount = ref(5)
const scorePerQuestion = ref(20)
const modelMode = ref<ModelMode>('high')
const questions = ref<ExamQuestion[]>([])

const selectedDocument = computed(() => knowledgeFiles.value.find((item) => item.document_id === selectedDocumentId.value))
const totalScore = computed(() => questions.value.reduce((total, item) => total + item.score, 0))
const answeredCount = computed(() => questions.value.filter((item) => item.userAnswer.trim()).length)

async function refreshKnowledgeFiles() {
  loading.value = true
  try {
    knowledgeFiles.value = await listKnowledgeFiles()
    if (!selectedDocumentId.value && knowledgeFiles.value.length > 0) {
      selectedDocumentId.value = knowledgeFiles.value[0].document_id
    }
  } finally {
    loading.value = false
  }
}

function extractQuestions(content: string): Array<{ question: string; answer: string }> {
  const blocks = content
    .split(/\n(?=\s*(?:\d+[.、]|问[:：]|Q[:：]))/i)
    .map((item) => item.trim())
    .filter(Boolean)

  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      const questionLine = lines.find((line) => /[?？]/.test(line)) || lines[0] || ''
      const answerIndex = lines.findIndex((line) => /^(答|A)[:：]/i.test(line))
      const answer = answerIndex >= 0 ? lines.slice(answerIndex).join('\n').replace(/^(答|A)[:：]\s*/i, '') : lines.slice(1).join('\n')
      const question = questionLine.replace(/^\d+[.、]\s*/, '').replace(/^(问|Q)[:：]\s*/i, '').trim()
      return { question, answer: answer.trim() }
    })
    .filter((item) => item.question && item.answer)
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

async function generatePaper() {
  if (!selectedDocumentId.value) {
    ElMessage.warning('请先选择一个知识库文件')
    return
  }
  generating.value = true
  try {
    const preview = await previewKnowledgeDocument(selectedDocumentId.value, 100000)
    const extracted = extractQuestions(preview.content)
    if (extracted.length === 0) {
      ElMessage.warning('当前文件没有解析到问答题，请选择问答型知识库文件')
      questions.value = []
      return
    }
    questions.value = shuffle(extracted).slice(0, questionCount.value).map((item, index) => ({
      id: `${selectedDocumentId.value}-${index}-${Date.now()}`,
      question: item.question,
      referenceAnswer: item.answer,
      score: scorePerQuestion.value,
      userAnswer: '',
    }))
    ElMessage.success(`已生成 ${questions.value.length} 道题`)
  } finally {
    generating.value = false
  }
}

function buildGradePrompt(question: ExamQuestion) {
  return [
    '你是严格但公正的阅卷老师。请根据参考答案给学生答案评分。',
    `题目：${question.question}`,
    `参考答案：${question.referenceAnswer}`,
    `学生答案：${question.userAnswer}`,
    `满分：${question.score}`,
    '请输出：得分、扣分点、改进建议。不要编造参考答案没有的内容。',
  ].join('\n\n')
}

async function gradePaper() {
  if (questions.value.length === 0) {
    ElMessage.warning('请先生成试卷')
    return
  }
  if (answeredCount.value < questions.value.length) {
    ElMessage.warning('还有题目未作答')
    return
  }
  grading.value = true
  try {
    for (const question of questions.value) {
      const response = await sendChat(buildGradePrompt(question), 'exam-user', null, modelMode.value, selectedDocument.value?.collection_name || 'agent')
      question.grading = response.answer
    }
    ElMessage.success('试卷评分完成')
  } finally {
    grading.value = false
  }
}

onMounted(() => {
  void refreshKnowledgeFiles()
})
</script>

<template>
  <div class="exam-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><ClipboardCheck :size="16" /> 问答考试</span>
        <h2>知识库测评台</h2>
        <p>从问答型知识库中抽题，完成答题后调用当前模型进行评分。</p>
      </div>
      <el-button class="tech-button" :icon="RefreshCw" :loading="loading" @click="refreshKnowledgeFiles">刷新题源</el-button>
    </header>

    <section class="exam-toolbar">
      <label>
        <span>题源文件</span>
        <el-select v-model="selectedDocumentId" filterable placeholder="选择知识库文件">
          <el-option v-for="file in knowledgeFiles" :key="file.document_id" :label="`${file.filename} / ${file.collection_name}`" :value="file.document_id" />
        </el-select>
      </label>
      <label>
        <span>题目数量</span>
        <el-input-number v-model="questionCount" :min="1" :max="50" />
      </label>
      <label>
        <span>单题分值</span>
        <el-input-number v-model="scorePerQuestion" :min="1" :max="100" />
      </label>
      <label>
        <span>评分模型档位</span>
        <el-select v-model="modelMode">
          <el-option label="高质量" value="high" />
          <el-option label="均衡" value="medium" />
          <el-option label="低延迟" value="low" />
        </el-select>
      </label>
      <el-button class="tech-button" :icon="Sparkles" :loading="generating" @click="generatePaper">生成试卷</el-button>
    </section>

    <section class="paper-summary">
      <span><FileQuestion :size="18" /> {{ questions.length }} 道题</span>
      <span>总分 {{ totalScore }}</span>
      <span>已答 {{ answeredCount }}/{{ questions.length }}</span>
      <span>考试接口 {{ API_BASE_URL }}/exam</span>
    </section>

    <section class="paper-sheet">
      <article v-for="(question, index) in questions" :key="question.id" class="question-card">
        <div class="question-head">
          <strong>第 {{ index + 1 }} 题</strong>
          <span>{{ question.score }} 分</span>
        </div>
        <p class="question-title">{{ question.question }}</p>
        <el-input v-model="question.userAnswer" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="请输入你的答案" />
        <details>
          <summary>查看参考答案</summary>
          <p>{{ question.referenceAnswer }}</p>
        </details>
        <div v-if="question.grading" class="grading-result">
          <strong>模型评分</strong>
          <p>{{ question.grading }}</p>
        </div>
      </article>
      <div v-if="questions.length === 0" class="empty-paper">请选择问答型知识库文件，然后生成试卷。</div>
    </section>

    <footer class="exam-footer">
      <el-button class="tech-button primary" :icon="ClipboardCheck" :loading="grading" :disabled="questions.length === 0" @click="gradePaper">提交并评分</el-button>
    </footer>
  </div>
</template>
