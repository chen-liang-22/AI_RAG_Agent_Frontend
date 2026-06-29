import type { Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { retryIngestTask } from '../api'
import type { TrainingKnowledgeBatchResponse, TrainingKnowledgeUploadResponse } from '../types'

interface RetryTrainingIngestTaskOptions {
  batch: TrainingKnowledgeBatchResponse
  retryingTaskId: Ref<string>
  uploadResult: Ref<TrainingKnowledgeUploadResponse | null>
  activeBatchId: Ref<string>
  clearActiveChunks: () => void
  refreshBatches: () => Promise<void>
  versionDialogVisible: Ref<boolean>
  loadBatchVersions: (batchId: string) => Promise<void>
  pollUntilReady: (batchId: string) => unknown
  afterRetry?: () => Promise<void>
}

export function buildTrainingBatchFromUploadResult(
  uploadResult: TrainingKnowledgeUploadResponse,
  sourceType: string,
): TrainingKnowledgeBatchResponse {
  return {
    batch_id: uploadResult.batch_id,
    document_id: uploadResult.document_id,
    task_id: uploadResult.task_id,
    task_status: uploadResult.task_status,
    current_step: uploadResult.current_step,
    progress: uploadResult.progress,
    source_type: sourceType,
    source_file: uploadResult.source_file || '当前资料',
    version_no: 1,
    is_current: false,
    status: uploadResult.status,
    chunk_count: uploadResult.chunk_count,
    point_count: uploadResult.point_count,
    error_message: uploadResult.error_message,
    quality_report: uploadResult.quality_report,
    created_at: '',
    updated_at: '',
  }
}

export async function retryTrainingIngestTaskForBatch(options: RetryTrainingIngestTaskOptions) {
  const { batch } = options
  if (!batch.task_id) {
    ElMessage.warning('当前资料缺少入库任务编号，不能直接重试')
    return false
  }

  options.retryingTaskId.value = batch.task_id
  try {
    const task = await retryIngestTask(batch.task_id)
    if (options.uploadResult.value?.batch_id === batch.batch_id) {
      options.uploadResult.value = {
        ...options.uploadResult.value,
        task_id: task.task_id,
        task_status: task.task_status,
        current_step: task.current_step,
        progress: task.progress,
        status: batch.status,
        error_message: task.error_message,
      }
    }
    if (options.activeBatchId.value === batch.batch_id) {
      options.clearActiveChunks()
    }
    await options.refreshBatches()
    if (options.versionDialogVisible.value) {
      await options.loadBatchVersions(batch.batch_id)
    }
    if (options.afterRetry) {
      await options.afterRetry()
    }
    ElMessage.success('已重新提交入库任务')
    void options.pollUntilReady(batch.batch_id)
    return true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '入库任务重试失败')
    return false
  } finally {
    options.retryingTaskId.value = ''
  }
}
