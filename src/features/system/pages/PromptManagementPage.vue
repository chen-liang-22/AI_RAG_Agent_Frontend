<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Edit3, Eye, MessageSquareText, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createPrompt,
  deletePrompt,
  getPrompt,
  HttpError,
  listDictionaries,
  listPrompts,
  updatePrompt,
  type AuthUser,
  type DictionaryItemResponse,
  type PromptCreatePayload,
  type PromptResponse,
  type PromptUpdatePayload,
  type PromptVariable,
} from '../../../shared/api'

const props = defineProps<{
  currentUser: AuthUser
}>()

const emit = defineEmits<{
  forbidden: []
}>()

interface PromptFormState { // 提示词新增和编辑弹窗表单
  promptKey: string
  promptCode: string
  domain: string
  promptName: string
  promptType: string
  content: string
  variables: string[]
  modelName: string
  description: string
  enabled: boolean
}

const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

const loading = ref(false)
const saving = ref(false)
const loadingChatModels = ref(false)
const activeAction = ref('')
// 列表请求序号用于丢弃过期响应，避免快速筛选和翻页时旧数据覆盖新数据。
let promptListRequestSequence = 0
const prompts = ref<PromptResponse[]>([])
const chatModelItems = ref<DictionaryItemResponse[]>([])
const enabledChatModelItems = computed(() => chatModelItems.value.filter((item) => item.enabled)) // 启用的聊天模型，仅供表单选择
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const domainFilter = ref('')
const enabledFilter = ref<boolean | ''>('')
const promptDialogVisible = ref(false)
const promptDetailVisible = ref(false)
const selectedPrompt = ref<PromptResponse | null>(null)
const editingPromptKey = ref('')
const promptForm = reactive<PromptFormState>({
  promptKey: '',
  promptCode: '',
  domain: '',
  promptName: '',
  promptType: '',
  content: '',
  variables: [],
  modelName: '',
  description: '',
  enabled: true,
})

const isAdmin = computed(() => props.currentUser.role === 'admin')
const dialogTitle = computed(() => editingPromptKey.value ? '编辑提示词' : '新增提示词')
const enabledOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
]

function chatModelLabel(value?: string | null): string { // 按聊天模型字典显示名称，字典缺失时回退原模型编码
  if (!value) return '未配置'
  return chatModelItems.value.find((item) => item.item_code === value)?.item_name || value
}

async function loadChatModels(): Promise<void> { // 读取全部聊天模型字典，保留停用项供历史数据显示
  loadingChatModels.value = true
  try {
    const groups = await listDictionaries('chat_model')
    chatModelItems.value = groups.find((group) => group.dictionary_code === 'chat_model')?.items || []
  } catch (error) {
    chatModelItems.value = []
    handleRequestError(error, '聊天模型字典读取失败')
  } finally {
    loadingChatModels.value = false
  }
}

function actionKey(action: string, promptKey: string): string {
  // 为行级操作生成稳定的加载状态键。
  return `${action}:${promptKey}`
}

function startRowAction(key: string): boolean {
  // 行操作全局串行，已有操作时拒绝新的详情、编辑、启停或删除请求。
  if (activeAction.value || saving.value || promptDialogVisible.value || promptDetailVisible.value) {
    ElMessage.warning('当前有提示词操作正在处理，请稍后重试')
    return false
  }
  activeAction.value = key
  return true
}

function isRowActionDisabled(action: string, promptKey: string): boolean {
  // 弹窗或其他行操作存在时禁用当前入口，当前操作仍保留加载状态。
  const key = actionKey(action, promptKey)
  return saving.value
    || promptDialogVisible.value
    || promptDetailVisible.value
    || Boolean(activeAction.value && activeAction.value !== key)
}

function handleRequestError(error: unknown, fallbackMessage: string): void {
  // 统一展示请求错误；权限失效时通知主页面离开管理入口。
  if (error instanceof HttpError && error.status === 403) {
    ElMessage.error('当前账号无权访问提示词管理')
    emit('forbidden')
    return
  }
  ElMessage.error(error instanceof Error ? error.message : fallbackMessage)
}

async function loadPrompts(): Promise<void> {
  // 按当前筛选条件读取提示词分页列表。
  const requestSequence = ++promptListRequestSequence
  if (!isAdmin.value) {
    loading.value = false
    emit('forbidden')
    return
  }
  loading.value = true
  try {
    const response = await listPrompts({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      domain: domainFilter.value.trim() || undefined,
      enabled: typeof enabledFilter.value === 'boolean' ? enabledFilter.value : undefined,
    })
    if (requestSequence !== promptListRequestSequence) return
    prompts.value = response.items
    total.value = response.total
  } catch (error) {
    if (requestSequence !== promptListRequestSequence) return
    handleRequestError(error, '提示词列表读取失败')
  } finally {
    if (requestSequence === promptListRequestSequence) loading.value = false
  }
}

function resetForm(): void {
  // 恢复新增提示词的空白表单。
  editingPromptKey.value = ''
  promptForm.promptKey = ''
  promptForm.promptCode = ''
  promptForm.domain = ''
  promptForm.promptName = ''
  promptForm.promptType = ''
  promptForm.content = ''
  promptForm.variables = []
  promptForm.modelName = ''
  promptForm.description = ''
  promptForm.enabled = true
}

function assignForm(prompt: PromptResponse): void {
  // 将服务端详情完整写入编辑表单，正文保持原始换行。
  editingPromptKey.value = prompt.prompt_key
  promptForm.promptKey = prompt.prompt_key
  promptForm.promptCode = prompt.prompt_code
  promptForm.domain = prompt.domain
  promptForm.promptName = prompt.prompt_name
  promptForm.promptType = prompt.prompt_type
  promptForm.content = prompt.content
  promptForm.variables = (prompt.variables || []).map((variable) => variable.name)
  promptForm.modelName = prompt.model_name || ''
  promptForm.description = prompt.description || ''
  promptForm.enabled = prompt.enabled
}

function openCreateDialog(): void {
  // 行操作或保存尚未结束时拒绝打开新增弹窗，避免异步详情覆盖空白表单。
  if (activeAction.value || saving.value) {
    ElMessage.warning('当前有提示词操作正在处理，请稍后重试')
    return
  }
  resetForm()
  promptDialogVisible.value = true
}

async function openDetailDialog(prompt: PromptResponse): Promise<void> {
  // 读取最新详情后打开独立只读弹窗，避免把编辑表单当作详情页面。
  const key = actionKey('detail', prompt.prompt_key)
  if (!startRowAction(key)) return
  try {
    const detail = await getPrompt(prompt.prompt_key)
    if (activeAction.value !== key) return
    selectedPrompt.value = detail
    promptDetailVisible.value = true
  } catch (error) {
    handleRequestError(error, '提示词详情读取失败')
  } finally {
    if (activeAction.value === key) activeAction.value = ''
  }
}

async function openEditDialog(prompt: PromptResponse): Promise<void> {
  // 读取最新详情后打开编辑弹窗，避免使用过期的列表正文。
  const key = actionKey('edit', prompt.prompt_key)
  if (!startRowAction(key)) return
  try {
    const detail = await getPrompt(prompt.prompt_key)
    if (activeAction.value !== key) return
    assignForm(detail)
    promptDialogVisible.value = true
  } catch (error) {
    handleRequestError(error, '提示词详情读取失败')
  } finally {
    if (activeAction.value === key) activeAction.value = ''
  }
}

function addVariable(): void {
  // 在表单末尾增加一个变量名输入项。
  promptForm.variables.push('')
}

function removeVariable(index: number): void {
  // 删除指定的变量名输入项。
  promptForm.variables.splice(index, 1)
}

function normalizeVariables(): PromptVariable[] | null {
  // 清理空变量并校验小写 snake_case 格式和唯一性。
  const names = promptForm.variables.map((name) => name.trim()).filter(Boolean)
  const invalidName = names.find((name) => !VARIABLE_NAME_PATTERN.test(name))
  if (invalidName) {
    ElMessage.warning(`变量名「${invalidName}」格式不正确，请使用小写 snake_case`)
    return null
  }
  if (new Set(names).size !== names.length) {
    ElMessage.warning('变量名不能重复')
    return null
  }
  return names.map((name) => ({ name }))
}

function buildUpdatePayload(): PromptUpdatePayload | null {
  // 校验必填项并生成全量修改请求。
  const requiredValues = [
    promptForm.promptCode,
    promptForm.domain,
    promptForm.promptName,
    promptForm.promptType,
  ]
  if (requiredValues.some((value) => !value.trim())) {
    ElMessage.warning('请完整填写提示词编码、业务域、名称和类型')
    return null
  }
  if (!promptForm.content.trim()) {
    ElMessage.warning('提示词正文不能为空')
    return null
  }
  if (promptForm.enabled && !promptForm.modelName) {
    ElMessage.warning('启用提示词时必须选择聊天模型')
    return null
  }
  const variables = normalizeVariables()
  if (!variables) return null
  return {
    prompt_code: promptForm.promptCode.trim(),
    domain: promptForm.domain.trim(),
    prompt_name: promptForm.promptName.trim(),
    prompt_type: promptForm.promptType.trim(),
    content: promptForm.content,
    variables,
    model_name: promptForm.modelName || null,
    description: promptForm.description.trim() || null,
    enabled: promptForm.enabled,
  }
}

function buildCreatePayload(): PromptCreatePayload | null {
  // 在全量业务字段基础上补充不可重复的提示词键。
  if (!promptForm.promptKey.trim()) {
    ElMessage.warning('提示词键不能为空')
    return null
  }
  const payload = buildUpdatePayload()
  if (!payload) return null
  return {
    prompt_key: promptForm.promptKey.trim(),
    ...payload,
  }
}

async function savePrompt(): Promise<void> {
  // 根据表单模式新增或全量修改提示词。
  const payload = editingPromptKey.value ? buildUpdatePayload() : buildCreatePayload()
  if (!payload) return
  saving.value = true
  try {
    if (editingPromptKey.value) {
      await updatePrompt(editingPromptKey.value, payload as PromptUpdatePayload)
      ElMessage.success('提示词已修改')
    } else {
      await createPrompt(payload as PromptCreatePayload)
      ElMessage.success('提示词已新增')
      page.value = 1
    }
    promptDialogVisible.value = false
    await loadPrompts()
  } catch (error) {
    handleRequestError(error, '提示词保存失败')
  } finally {
    saving.value = false
  }
}

function buildRowUpdatePayload(prompt: PromptResponse, enabled: boolean): PromptUpdatePayload {
  // 基于当前行构造启停所需的全量修改请求。
  return {
    prompt_code: prompt.prompt_code,
    domain: prompt.domain,
    prompt_name: prompt.prompt_name,
    prompt_type: prompt.prompt_type,
    content: prompt.content,
    variables: prompt.variables || [],
    model_name: prompt.model_name || null,
    description: prompt.description || null,
    enabled,
  }
}

async function togglePromptEnabled(prompt: PromptResponse, value: boolean | string | number): Promise<void> {
  // 使用全量修改接口切换提示词启用状态。
  const enabled = value === true || value === 1 || value === 'true'
  const key = actionKey('enabled', prompt.prompt_key)
  if (!startRowAction(key)) return
  try {
    const detail = await getPrompt(prompt.prompt_key)
    if (activeAction.value !== key) return
    if (enabled && !detail.model_name) {
      ElMessage.warning('请先编辑提示词并选择聊天模型，再启用提示词')
      return
    }
    await updatePrompt(prompt.prompt_key, buildRowUpdatePayload(detail, enabled))
    ElMessage.success(enabled ? '提示词已启用' : '提示词已停用')
    await loadPrompts()
  } catch (error) {
    handleRequestError(error, enabled ? '提示词启用失败' : '提示词停用失败')
  } finally {
    if (activeAction.value === key) activeAction.value = ''
  }
}

async function removePrompt(prompt: PromptResponse): Promise<void> {
  // 二次确认后删除提示词，并修正空分页的位置。
  const key = actionKey('delete', prompt.prompt_key)
  if (!startRowAction(key)) return
  try {
    await ElMessageBox.confirm(
      `确认删除提示词「${prompt.prompt_name}」吗？删除后不可恢复。`,
      '删除提示词',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await deletePrompt(prompt.prompt_key)
    ElMessage.success('提示词已删除')
    if (prompts.value.length === 1 && page.value > 1) page.value -= 1
    await loadPrompts()
  } catch (error) {
    if (error instanceof Error) handleRequestError(error, '提示词删除失败')
  } finally {
    if (activeAction.value === key) activeAction.value = ''
  }
}

function handleSearch(): void {
  // 从第一页执行新的筛选查询。
  page.value = 1
  void loadPrompts()
}

function handlePageSizeChange(): void {
  // 修改每页数量后回到第一页查询。
  page.value = 1
  void loadPrompts()
}

function formatDateTime(value: string): string {
  // 将 ISO 时间中的分隔符转换为紧凑的列表展示格式。
  return value ? value.replace('T', ' ').replace(/\.\d+(Z|[+-]\d{2}:?\d{2})?$/, '') : '-'
}

onMounted(() => {
  // 页面挂载时再次校验管理员角色，再读取数据。
  if (!isAdmin.value) {
    emit('forbidden')
    return
  }
  void loadPrompts()
  void loadChatModels()
})
</script>

<template>
  <div class="system-page prompt-management-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><MessageSquareText :size="14" /> 系统管理</span>
        <h2>提示词管理</h2>
        <p>当前共 {{ total }} 条提示词配置</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button :icon="RefreshCw" :loading="loading" plain @click="loadPrompts">刷新</el-button>
        <el-button
          :icon="Plus"
          type="primary"
          :disabled="Boolean(activeAction) || saving"
          @click="openCreateDialog"
        >
          新增提示词
        </el-button>
      </div>
    </header>

    <section class="system-panel">
      <div class="system-toolbar">
        <el-input
          v-model="keyword"
          class="system-search-input"
          clearable
          placeholder="搜索键、编码或名称"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-input
          v-model="domainFilter"
          class="prompt-domain-filter"
          clearable
          placeholder="业务域"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select
          v-model="enabledFilter"
          class="prompt-enabled-filter"
          clearable
          placeholder="全部状态"
          @change="handleSearch"
        >
          <el-option
            v-for="item in enabledOptions"
            :key="String(item.value)"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button type="primary" plain :icon="Search" @click="handleSearch">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="prompts" class="system-table" row-key="prompt_id">
        <el-table-column label="提示词" min-width="250">
          <template #default="{ row }: { row: PromptResponse }">
            <div class="prompt-name-cell">
              <strong>{{ row.prompt_name }}</strong>
              <code>{{ row.prompt_key }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="prompt_code" label="编码" min-width="190" show-overflow-tooltip />
        <el-table-column prop="domain" label="业务域" width="130" show-overflow-tooltip />
        <el-table-column prop="prompt_type" label="类型" width="130" show-overflow-tooltip />
        <el-table-column label="聊天模型" min-width="170" show-overflow-tooltip>
          <template #default="{ row }: { row: PromptResponse }">
            {{ chatModelLabel(row.model_name) }}
          </template>
        </el-table-column>
        <el-table-column label="正文" min-width="300">
          <template #default="{ row }: { row: PromptResponse }">
            <div class="prompt-content-preview" :title="row.content">{{ row.content }}</div>
          </template>
        </el-table-column>
        <el-table-column label="变量" min-width="190">
          <template #default="{ row }: { row: PromptResponse }">
            <div v-if="row.variables?.length" class="prompt-variable-tags">
              <el-tag v-for="variable in row.variables" :key="variable.name" effect="plain" size="small">
                {{ variable.name }}
              </el-tag>
            </div>
            <span v-else class="prompt-empty-value">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }: { row: PromptResponse }">
            <el-switch
              :model-value="row.enabled"
              inline-prompt
              active-text="启"
              inactive-text="停"
              :disabled="isRowActionDisabled('enabled', row.prompt_key)"
              :loading="activeAction === actionKey('enabled', row.prompt_key)"
              @change="togglePromptEnabled(row, $event)"
            />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }: { row: PromptResponse }">
            {{ formatDateTime(row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }: { row: PromptResponse }">
            <div class="system-row-actions">
              <el-button
                :icon="Eye"
                size="small"
                plain
                :disabled="isRowActionDisabled('detail', row.prompt_key)"
                :loading="activeAction === actionKey('detail', row.prompt_key)"
                @click="openDetailDialog(row)"
              >
                详情
              </el-button>
              <el-button
                :icon="Edit3"
                size="small"
                plain
                :disabled="isRowActionDisabled('edit', row.prompt_key)"
                :loading="activeAction === actionKey('edit', row.prompt_key)"
                @click="openEditDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                :icon="Trash2"
                size="small"
                type="danger"
                plain
                :disabled="isRowActionDisabled('delete', row.prompt_key)"
                :loading="activeAction === actionKey('delete', row.prompt_key)"
                @click="removePrompt(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="system-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          :total="total"
          @current-change="loadPrompts"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog
      v-model="promptDetailVisible"
      title="提示词详情"
      width="820px"
      class="system-dialog prompt-detail-dialog"
      @closed="selectedPrompt = null"
    >
      <div v-if="selectedPrompt" class="prompt-detail-body">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="提示词名称">{{ selectedPrompt.prompt_name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedPrompt.enabled ? 'success' : 'info'" effect="plain">
              {{ selectedPrompt.enabled ? '启用' : '停用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提示词键">{{ selectedPrompt.prompt_key }}</el-descriptions-item>
          <el-descriptions-item label="提示词 ID">{{ selectedPrompt.prompt_id }}</el-descriptions-item>
          <el-descriptions-item label="提示词编码">{{ selectedPrompt.prompt_code }}</el-descriptions-item>
          <el-descriptions-item label="业务域">{{ selectedPrompt.domain }}</el-descriptions-item>
          <el-descriptions-item label="提示词类型">{{ selectedPrompt.prompt_type }}</el-descriptions-item>
          <el-descriptions-item label="聊天模型">{{ chatModelLabel(selectedPrompt.model_name) }}</el-descriptions-item>
          <el-descriptions-item label="变量">
            <div v-if="selectedPrompt.variables?.length" class="prompt-variable-tags">
              <el-tag
                v-for="variable in selectedPrompt.variables"
                :key="variable.name"
                effect="plain"
                size="small"
              >
                {{ variable.name }}
              </el-tag>
            </div>
            <span v-else class="prompt-empty-value">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="说明" :span="2">
            <span class="prompt-detail-text">{{ selectedPrompt.description || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建人">{{ selectedPrompt.created_by || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(selectedPrompt.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新人">{{ selectedPrompt.updated_by || '-' }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDateTime(selectedPrompt.updated_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <section class="prompt-detail-content">
          <strong>提示词正文</strong>
          <pre>{{ selectedPrompt.content }}</pre>
        </section>
      </div>
      <template #footer>
        <el-button @click="promptDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="promptDialogVisible"
      :title="dialogTitle"
      width="900px"
      class="system-dialog prompt-dialog"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form class="system-form" label-position="top">
        <div class="system-form-grid prompt-form-grid">
          <el-form-item label="提示词键">
            <el-input
              v-model="promptForm.promptKey"
              :disabled="Boolean(editingPromptKey)"
              placeholder="例如：knowledge.answer.system"
            />
          </el-form-item>
          <el-form-item label="提示词编码">
            <el-input v-model="promptForm.promptCode" placeholder="例如：knowledge.answer" />
          </el-form-item>
          <el-form-item label="业务域">
            <el-input v-model="promptForm.domain" placeholder="例如：knowledge" />
          </el-form-item>
          <el-form-item label="提示词名称">
            <el-input v-model="promptForm.promptName" placeholder="请输入提示词名称" />
          </el-form-item>
          <el-form-item label="提示词类型">
            <el-input v-model="promptForm.promptType" placeholder="例如：system、user" />
          </el-form-item>
          <el-form-item label="聊天模型">
            <el-select
              v-model="promptForm.modelName"
              clearable
              placeholder="使用 Prompt 配置"
              :loading="loadingChatModels"
            >
              <el-option
                v-for="item in enabledChatModelItems"
                :key="item.item_code"
                :label="item.item_name"
                :value="item.item_code"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="启用状态">
            <el-switch
              v-model="promptForm.enabled"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
            />
          </el-form-item>
          <el-form-item class="prompt-form-wide" label="说明">
            <el-input v-model="promptForm.description" placeholder="请输入说明" />
          </el-form-item>
          <el-form-item class="prompt-form-wide" label="提示词正文">
            <el-input
              v-model="promptForm.content"
              class="prompt-content-editor"
              type="textarea"
              resize="vertical"
              :autosize="{ minRows: 12, maxRows: 22 }"
              placeholder="请输入提示词正文"
            />
          </el-form-item>
          <el-form-item class="prompt-form-wide" label="模板变量">
            <div class="prompt-variable-editor">
              <div v-for="(_, index) in promptForm.variables" :key="index" class="prompt-variable-row">
                <el-input
                  v-model="promptForm.variables[index]"
                  placeholder="小写 snake_case，例如：query"
                />
                <el-button
                  :icon="Trash2"
                  circle
                  plain
                  type="danger"
                  title="删除变量"
                  aria-label="删除变量"
                  @click="removeVariable(index)"
                />
              </div>
              <el-button :icon="Plus" plain @click="addVariable">添加变量</el-button>
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="promptDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePrompt">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.prompt-domain-filter {
  width: min(190px, 100%);
}

.prompt-enabled-filter {
  width: min(150px, 100%);
}

.prompt-name-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.prompt-name-cell strong,
.prompt-name-cell code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-name-cell code {
  color: var(--text-muted);
  font-size: 12px;
}

.prompt-content-preview {
  display: -webkit-box;
  max-height: 66px;
  overflow: hidden;
  color: var(--text-soft);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.prompt-variable-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.prompt-empty-value {
  color: var(--text-muted);
}

.prompt-form-wide {
  grid-column: 1 / -1;
}

.prompt-variable-editor {
  display: grid;
  gap: 8px;
  width: 100%;
}

.prompt-variable-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 8px;
  align-items: center;
}

.prompt-variable-row .el-button {
  width: 32px;
  height: 32px;
}

.prompt-content-editor :deep(.el-textarea__inner) {
  font-family: Consolas, "Courier New", monospace;
  line-height: 1.65;
  white-space: pre-wrap;
}

.prompt-detail-body {
  display: grid;
  gap: 20px;
}

.prompt-detail-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.prompt-detail-content {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding-top: 2px;
}

.prompt-detail-content strong {
  color: var(--text);
  font-size: 14px;
}

.prompt-detail-content pre {
  max-height: 42vh;
  margin: 0;
  overflow: auto;
  color: var(--text-soft);
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .prompt-domain-filter,
  .prompt-enabled-filter {
    width: 100%;
  }

  .prompt-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
