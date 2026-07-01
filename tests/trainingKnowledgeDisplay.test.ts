import assert from 'node:assert/strict'
import test from 'node:test'

import {
  trainingKnowledgeFlowSteps,
  trainingKnowledgeFlowSummary,
  trainingKnowledgeQualityMetricItems,
  trainingKnowledgeQualitySummary,
  trainingKnowledgeQualityWarnings,
  trainingKnowledgeSplitterLabel,
} from '../src/features/sales-training/composables/trainingKnowledgeDisplay.ts'

test('training knowledge flow summary shows active upload progress', () => {
  const item = {
    status: 'parsing',
    task_status: 'running',
    current_step: 'chunking',
    progress: 42,
    quality_report: {},
  }

  assert.equal(trainingKnowledgeFlowSummary(item), '正在生成切片 · 42%')
  assert.deepEqual(
    trainingKnowledgeFlowSteps(item).map((step) => `${step.label}:${step.status}`),
    ['保存文件:done', '解析内容:done', '生成切片:active', '质量评分:waiting', '写入向量:waiting', '待确认发布:waiting'],
  )
})

test('training knowledge quality summary keeps score area visible before scoring completes', () => {
  const summary = trainingKnowledgeQualitySummary({})

  assert.equal(summary.scoreText, '待评分')
  assert.equal(summary.levelText, '质量评分未生成')
  assert.equal(summary.detailText, '后台完成切片后会显示文档得分')
  assert.equal(summary.warningCount, 0)
})

test('training knowledge display translates splitter and warnings', () => {
  const report = {
    score: 40,
    level: 'poor',
    summary: '资料不适合销售训练',
    selected_splitter: 'rule_config',
    warnings: ['缺少客户信息', '缺少任务要求'],
  }

  assert.equal(trainingKnowledgeQualitySummary(report).scoreText, '40 分')
  assert.equal(trainingKnowledgeQualitySummary(report).warningCount, 2)
  assert.equal(trainingKnowledgeSplitterLabel(report), '规则配置切分')
})

test('training knowledge quality warnings keeps every warning visible', () => {
  const report = {
    warnings: ['缺少客户信息', '缺少任务要求', '缺少评分标准', '平均切片过短'],
  }

  assert.deepEqual(trainingKnowledgeQualityWarnings(report), [
    '缺少客户信息',
    '缺少任务要求',
    '缺少评分标准',
    '平均切片过短',
  ])
})

test('training knowledge quality metrics are translated for upload card display', () => {
  const report = {
    metrics: {
      chunk_count: 8,
      case_count: 2,
      avg_chunk_chars: 168,
      missing_required_parts: ['case_profile', 'task_requirement'],
      single_part_ratio: 0.625,
    },
  }

  assert.deepEqual(trainingKnowledgeQualityMetricItems(report), [
    { label: '切片数', value: '8' },
    { label: '案例数', value: '2' },
    { label: '平均字数', value: '168' },
    { label: '缺少核心片段', value: 'case_profile、task_requirement' },
    { label: '单一片段占比', value: '62.5%' },
  ])
})
