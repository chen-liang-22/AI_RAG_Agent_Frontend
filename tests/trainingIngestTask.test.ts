import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canDeleteTrainingKnowledgeBatch,
  canOpenTrainingKnowledgeChunks,
  canPublishTrainingKnowledgeBatch,
  canReparseTrainingKnowledgeBatch,
  canRetryTrainingIngestTask,
  isTrainingIngestProcessing,
  trainingIngestProgress,
  trainingIngestStepLabel,
} from '../src/features/sales-training/composables/trainingIngestTask.ts'

test('queued and running training ingest tasks are treated as processing', () => {
  assert.equal(isTrainingIngestProcessing({ status: 'parsing', task_status: 'queued' }), true)
  assert.equal(isTrainingIngestProcessing({ status: 'parsing', task_status: 'running' }), true)
})

test('completed pending review batch can be opened, published and reparsed', () => {
  const batch = { status: 'pending_review', task_status: 'succeeded', current_step: 'succeeded', progress: 100 }

  assert.equal(isTrainingIngestProcessing(batch), false)
  assert.equal(canOpenTrainingKnowledgeChunks(batch), true)
  assert.equal(canPublishTrainingKnowledgeBatch(batch), true)
  assert.equal(canReparseTrainingKnowledgeBatch(batch), true)
})

test('published batch can be opened but is not reparsed by current backend contract', () => {
  const batch = { status: 'published', task_status: 'succeeded', current_step: 'succeeded', progress: 100 }

  assert.equal(canOpenTrainingKnowledgeChunks(batch), true)
  assert.equal(canPublishTrainingKnowledgeBatch(batch), false)
  assert.equal(canReparseTrainingKnowledgeBatch(batch), false)
})

test('queued and running tasks cannot be deleted while failed tasks can be retried', () => {
  assert.equal(canDeleteTrainingKnowledgeBatch({ status: 'parsing', task_status: 'running' }), false)
  assert.equal(canDeleteTrainingKnowledgeBatch({ status: 'parsing', task_status: 'queued' }), false)
  assert.equal(canRetryTrainingIngestTask({ status: 'parsing_failed', task_status: 'failed' }), true)
})

test('progress is clamped and step code is translated', () => {
  assert.equal(trainingIngestProgress({ progress: 120 }), 100)
  assert.equal(trainingIngestStepLabel({ current_step: 'llm_chunking' }), 'LLM 正在优化切片')
})
