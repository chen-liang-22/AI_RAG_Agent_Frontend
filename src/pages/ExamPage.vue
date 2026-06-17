<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  BookOpenCheck,
  ClipboardCheck,
  FileQuestion,
  ListChecks,
  RefreshCw,
  Sparkles,
  Trophy,
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import {
  API_BASE_URL,
  generateExamPaper,
  gradeExamPaper,
  listKnowledgeFiles,
  type ExamGradeResult,
  type ExamQuestionResponse,
  type KnowledgeFileResponse,
  type ModelMode,
} from '../api'

defineProps<{ themeMode: 'dark' | 'light' }>()

interface ExamQuestion extends ExamQuestionResponse {
  userAnswer: string
  grading?: ExamGradeResult
}

const loading = ref(false)
const generating = ref(false)
const grading = ref(false)
const knowledgeFiles = ref<KnowledgeFileResponse[]>([])
const selectedDocumentId = ref('')
const questionCount = ref(5)
const scorePerQuestion = ref(20)
const modelMode = ref<ModelMode>('high')
const randomSeed = ref<number | null>(null)
const paperId = ref('')
const paperTitle = ref('知识掌握度测评')
const questions = ref<ExamQuestion[]>([])
const gradeTotalScore = ref<number | null>(null)
const gradeMaxScore = ref<number | null>(null)

const selectedDocument = computed(() => knowledgeFiles.value.find((item) => item.document_id === selectedDocumentId.value))
const totalScore = computed(() => questions.value.reduce((total, item) => total + item.score, 0))
const answeredCount = computed(() => questions.value.filter((item) => item.userAnswer.trim()).length)
const gradedCount = computed(() => questions.value.filter((item) => item.grading).length)
const scoreRate = computed(() => {
  if (gradeTotalScore.value === null || !gradeMaxScore.value) return null
  return Math.round((gradeTotalScore.value / gradeMaxScore.value) * 100)
})

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

function resetGradeState() {
  gradeTotalScore.value = null
  gradeMaxScore.value = null
}

async function generatePaper() {
  if (!selectedDocumentId.value) {
    ElMessage.warning('请先选择一个知识库文件')
    return
  }

  generating.value = true
  resetGradeState()
  try {
    const response = await generateExamPaper({
      collection_name: selectedDocument.value?.collection_name || null,
      document_id: selectedDocumentId.value,
      mode: 'random_practice',
      question_count: questionCount.value,
      score_per_question: scorePerQuestion.value,
      difficulty: 'medium',
      seed: randomSeed.value,
      question_types: ['short_answer'],
    })

    paperId.value = response.paper_id
    paperTitle.value = response.title
    questions.value = response.questions.map((question) => ({
      ...question,
      userAnswer: '',
      grading: undefined,
    }))
    ElMessage.success(`已生成 ${questions.value.length} 道题`)
  } catch (error) {
    questions.value = []
    paperId.value = ''
    ElMessage.error(error instanceof Error ? error.message : '试卷生成失败')
  } finally {
    generating.value = false
  }
}

async function gradePaper() {
  if (!paperId.value || questions.value.length === 0) {
    ElMessage.warning('请先生成试卷')
    return
  }
  if (answeredCount.value < questions.value.length) {
    ElMessage.warning('还有题目未作答')
    return
  }

  grading.value = true
  try {
    const response = await gradeExamPaper({
      paper_id: paperId.value,
      user_id: 'exam-user',
      model_mode: modelMode.value,
      answers: questions.value.map((question) => ({
        question_id: question.question_id,
        answer: question.userAnswer,
        question: question.question,
        reference_answer: question.reference_answer,
        max_score: question.score,
      })),
    })

    const gradeByQuestionId = new Map(response.results.map((item) => [item.question_id, item]))
    questions.value = questions.value.map((question) => ({
      ...question,
      grading: gradeByQuestionId.get(question.question_id),
    }))
    gradeTotalScore.value = response.total_score
    gradeMaxScore.value = response.max_score
    ElMessage.success('试卷评分完成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '试卷评分失败')
  } finally {
    grading.value = false
  }
}

function sourceText(question: ExamQuestion) {
  const source = question.source
  return [
    source.filename,
    source.section_path,
    source.source_page ? `第 ${source.source_page} 页` : '',
  ].filter(Boolean).join(' / ') || '题库来源'
}

function pointList(items: string[]) {
  return items.length > 0 ? items : ['无']
}

onMounted(() => {
  void refreshKnowledgeFiles()
})
</script>

<template>
  <div class="exam-page">
    <header class="page-hero exam-hero">
      <div>
        <span class="page-kicker"><ClipboardCheck :size="16" /> 知识掌握度测评</span>
        <h2>题库测评台</h2>
        <p>从后端结构化题库抽题，提交后由阅卷模型批量评分，并按题展示命中点、缺失点和复习建议。</p>
      </div>
      <div class="exam-hero-actions">
        <el-button class="tech-button" :icon="RefreshCw" :loading="loading" @click="refreshKnowledgeFiles">刷新题源</el-button>
        <el-button class="tech-button primary" :icon="Sparkles" :loading="generating" @click="generatePaper">生成试卷</el-button>
      </div>
    </header>

    <section class="exam-workbench">
      <aside class="exam-control-panel">
        <div class="panel-title"><ListChecks :size="16" /> 组卷参数</div>
        <label>
          <span>题源文件</span>
          <el-select v-model="selectedDocumentId" filterable placeholder="选择知识库文件">
            <el-option
              v-for="file in knowledgeFiles"
              :key="file.document_id"
              :label="`${file.filename} / ${file.collection_name}`"
              :value="file.document_id"
            />
          </el-select>
        </label>
        <div class="exam-control-grid">
          <label>
            <span>题目数量</span>
            <el-input-number v-model="questionCount" :min="1" :max="50" />
          </label>
          <label>
            <span>单题分值</span>
            <el-input-number v-model="scorePerQuestion" :min="1" :max="100" />
          </label>
        </div>
        <label>
          <span>评分模型档位</span>
          <el-select v-model="modelMode">
            <el-option label="高质量" value="high" />
            <el-option label="均衡" value="medium" />
            <el-option label="低延迟" value="low" />
          </el-select>
        </label>
        <label>
          <span>随机种子</span>
          <el-input-number v-model="randomSeed" :min="1" :max="999999" placeholder="可不填" />
        </label>
        <div class="exam-endpoint">
          <span>接口</span>
          <strong>{{ API_BASE_URL }}/exam</strong>
        </div>
      </aside>

      <section class="exam-stage">
        <section class="paper-summary">
          <span><FileQuestion :size="18" /> {{ questions.length }} 道题</span>
          <span>总分 {{ totalScore }}</span>
          <span><BookOpenCheck :size="18" /> 已答 {{ answeredCount }}/{{ questions.length }}</span>
          <span><ClipboardCheck :size="18" /> 已评 {{ gradedCount }}/{{ questions.length }}</span>
          <span v-if="gradeTotalScore !== null"><Trophy :size="18" /> {{ gradeTotalScore }}/{{ gradeMaxScore }} 分</span>
          <span v-if="scoreRate !== null">得分率 {{ scoreRate }}%</span>
        </section>

        <section class="paper-sheet">
          <div v-if="paperId" class="paper-heading">
            <div>
              <strong>{{ paperTitle }}</strong>
              <em>试卷编号：{{ paperId }}</em>
            </div>
            <el-button
              class="tech-button primary"
              :icon="ClipboardCheck"
              :loading="grading"
              :disabled="questions.length === 0"
              @click="gradePaper"
            >
              提交并评分
            </el-button>
          </div>

          <article v-for="(question, index) in questions" :key="question.question_id" class="question-card">
            <div class="question-head">
              <strong>第 {{ index + 1 }} 题</strong>
              <span>{{ question.score }} 分 · {{ question.question_type === 'short_answer' ? '简答题' : question.question_type }}</span>
            </div>
            <p class="question-title">{{ question.question }}</p>
            <div class="question-source">{{ sourceText(question) }}</div>
            <el-input
              v-model="question.userAnswer"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 10 }"
              placeholder="请输入你的答案"
              @input="resetGradeState"
            />
            <details>
              <summary>查看参考答案</summary>
              <p>{{ question.reference_answer }}</p>
            </details>

            <div v-if="question.grading" class="grading-result">
              <div class="grading-score">
                <strong>{{ question.grading.score }}/{{ question.grading.max_score }} 分</strong>
                <span>{{ question.grading.comment || '暂无点评' }}</span>
              </div>
              <div class="grading-grid">
                <div>
                  <b>命中要点</b>
                  <ul>
                    <li v-for="item in pointList(question.grading.hit_points)" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div>
                  <b>缺失要点</b>
                  <ul>
                    <li v-for="item in pointList(question.grading.missing_points)" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div>
                  <b>错误点</b>
                  <ul>
                    <li v-for="item in pointList(question.grading.wrong_points)" :key="item">{{ item }}</li>
                  </ul>
                </div>
              </div>
              <p class="review-suggestion">{{ question.grading.review_suggestion || '暂无复习建议' }}</p>
            </div>
          </article>

          <div v-if="questions.length === 0" class="empty-paper">
            <FileQuestion :size="28" />
            <strong>还没有生成试卷</strong>
            <span>选择已入库的问答型文件后，点击“生成试卷”。</span>
          </div>
        </section>
      </section>
    </section>
  </div>
</template>
