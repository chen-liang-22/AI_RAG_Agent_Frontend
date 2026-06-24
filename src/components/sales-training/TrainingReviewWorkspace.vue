<script setup lang="ts">
// 训练复盘工作区：只负责历史训练与评分报告展示，数据加载和历史详情读取仍由父页面统一处理。
import { Route, Trophy } from 'lucide-vue-next'
import type { TrainingScoreResponse, TrainingSessionSummaryResponse } from '../../api'
import { displayValue, reportPointList } from '../../utils/trainingDisplay'

const props = defineProps<{
  trainingHistories: TrainingSessionSummaryResponse[]
  historyTotal: number
  scoreResult: TrainingScoreResponse | null
  report: Record<string, unknown>
  loadingHistory: boolean
  loadingDetail: boolean
  formatTime: (value: string | null | undefined) => string
}>()

const historyPage = defineModel<number>('historyPage', { required: true })

const emit = defineEmits<{
  refreshHistory: []
  openHistory: [item: TrainingSessionSummaryResponse]
}>()

function historyScoreText(item: TrainingSessionSummaryResponse): string {
  // 历史训练可能还未评分，统一在组件内兜底，避免列表出现空值或 null。
  return item.total_score === null || item.total_score === undefined
    ? '未评分'
    : `${item.total_score}分 / ${item.level || '-'}`
}
</script>

<template>
  <section class="training-review-workspace">
    <section class="training-panel history-panel">
      <div class="panel-title panel-title-between">
        <span><Route :size="16" /> 最近训练</span>
        <el-button text :loading="loadingHistory" @click="emit('refreshHistory')">刷新</el-button>
      </div>
      <div class="training-history-list" v-loading="loadingHistory || loadingDetail">
        <button
          v-for="item in trainingHistories"
          :key="item.session_id"
          type="button"
          @click="emit('openHistory', item)"
        >
          <strong>{{ formatTime(item.started_at) }}</strong>
          <span>{{ item.status }} · {{ item.answered_count }}/{{ item.round_limit }} 轮</span>
          <em>{{ historyScoreText(item) }}</em>
        </button>
        <div v-if="trainingHistories.length === 0" class="training-empty compact">
          <Route :size="24" />
          <span>暂无训练历史。</span>
        </div>
      </div>
      <el-pagination
        v-model:current-page="historyPage"
        size="small"
        layout="prev, pager, next"
        :page-size="6"
        :total="historyTotal"
        @current-change="emit('refreshHistory')"
      />
    </section>

    <section class="training-panel score-panel">
      <div class="panel-title panel-title-between">
        <span><Trophy :size="16" /> 评分报告</span>
        <em>{{ scoreResult ? `${scoreResult.total_score} 分` : '未评分' }}</em>
      </div>
      <template v-if="scoreResult">
        <div class="score-ring">
          <strong>{{ scoreResult.total_score }}</strong>
          <span>{{ scoreResult.level }}</span>
        </div>
        <div class="score-breakdown">
          <span>通用能力 {{ scoreResult.general_score }}/40</span>
          <span>阶段能力 {{ scoreResult.stage_score }}/60</span>
          <span>扣分 {{ scoreResult.penalty_score }}</span>
        </div>
        <div class="report-list">
          <b>命中点</b>
          <p v-for="item in reportPointList(report.hit_points)" :key="item">{{ item }}</p>
          <b>遗漏点</b>
          <p v-for="item in reportPointList(report.missing_points)" :key="item">{{ item }}</p>
          <b>改进建议</b>
          <p>{{ displayValue(report.improvement_advice || '暂无') }}</p>
          <b>参考话术</b>
          <p>{{ displayValue(report.reference_script || '暂无') }}</p>
        </div>
      </template>
      <div v-else class="training-empty compact">
        <Trophy :size="24" />
        <span>选择一场训练或完成评分后查看报告。</span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.training-review-workspace {
  display: grid;
  grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
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

.training-history-list,
.report-list {
  display: grid;
  gap: 8px;
}

.training-history-list {
  min-height: 112px;
  max-height: 260px;
  overflow-y: auto;
}

.training-history-list button,
.score-breakdown,
.report-list p {
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
}

.training-history-list button {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.training-history-list button:hover {
  border-color: color-mix(in srgb, var(--cyan) 46%, var(--line));
  box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 18%, transparent);
  transform: translateY(-1px);
}

.training-history-list span,
.training-history-list em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.score-ring {
  display: grid;
  place-items: center;
  gap: 3px;
  width: 128px;
  height: 128px;
  margin: 4px auto 12px;
  border: 1px solid color-mix(in srgb, var(--cyan) 42%, var(--line));
  border-radius: 50%;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--surface) 86%, transparent) 0 54%, transparent 55%),
    conic-gradient(var(--cyan), var(--primary), var(--green), var(--cyan));
  box-shadow: 0 0 26px color-mix(in srgb, var(--cyan) 28%, transparent);
}

.score-ring strong {
  font-size: 34px;
}

.score-ring span {
  color: var(--text-muted);
  font-size: 12px;
}

.score-breakdown {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px;
}

.score-breakdown span,
.report-list b {
  color: var(--text);
  font-size: 13px;
}

.report-list p {
  margin: 0;
  padding: 8px 10px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
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

@media (max-width: 1320px) {
  .training-review-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
