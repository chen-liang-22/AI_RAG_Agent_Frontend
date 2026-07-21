<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  BookKey,
  ChevronRight,
  CirclePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createDictionaryItem,
  deleteDictionaryGroup,
  deleteDictionaryItem,
  HttpError,
  listDictionaries,
  setDictionaryItemEnabled,
  updateDictionaryGroup,
  updateDictionaryItem,
  type AuthUser,
  type DictionaryGroupResponse,
  type DictionaryItemResponse,
} from '../../../shared/api'

const props = defineProps<{
  currentUser: AuthUser
}>()

const emit = defineEmits<{
  forbidden: []
}>()

interface DictionaryGroupFormState { // 新增分组时同时收集首个字典项，修改分组时只使用编码和名称
  dictionaryCode: string
  dictionaryName: string
  itemCode: string
  itemName: string
  sortOrder: number
  enabled: boolean
  description: string
  metadataText: string
}

interface DictionaryItemFormState { // 字典项新增与修改表单，所属分组只由当前选中分组决定
  itemCode: string
  itemName: string
  parentItemId: string
  sortOrder: number
  enabled: boolean
  description: string
  metadataText: string
}

interface DictionaryParentOption { // 父级选择项，额外记录层级和是否允许选择
  item: DictionaryItemResponse
  depth: number
  disabled: boolean
}

const groups = ref<DictionaryGroupResponse[]>([])
const loading = ref(false)
const groupKeyword = ref('')
const activeDictionaryCode = ref('')
const groupDialogVisible = ref(false)
const groupSaving = ref(false)
const editingDictionaryGroupCode = ref('')
const itemDialogVisible = ref(false)
const itemSaving = ref(false)
const editingDictionaryItemId = ref('')
const activeAction = ref('')
const groupForm = ref<DictionaryGroupFormState>(emptyGroupForm())
const itemForm = ref<DictionaryItemFormState>(emptyItemForm())

const filteredGroups = computed(() => {
  // 分组搜索同时匹配名称和编码，便于管理大量系统字典。
  const keyword = groupKeyword.value.trim().toLowerCase()
  if (!keyword) return groups.value
  return groups.value.filter((group) => (
    group.dictionary_name.toLowerCase().includes(keyword)
    || group.dictionary_code.toLowerCase().includes(keyword)
  ))
})

const activeGroup = computed(() => (
  groups.value.find((group) => group.dictionary_code === activeDictionaryCode.value) || null
))

const totalItemCount = computed(() => groups.value.reduce(
  (total, group) => total + flattenDictionaryItems(group.items).length,
  0,
))

const activeEnabledCount = computed(() => (
  activeGroup.value
    ? flattenDictionaryItems(activeGroup.value.items).filter((item) => item.enabled).length
    : 0
))

const dictionaryParentOptions = computed<DictionaryParentOption[]>(() => {
  // 修改父级时排除当前项及其全部后代，前端先阻止形成循环层级。
  if (!activeGroup.value) return []
  const disabledIds = editingDictionaryItemId.value
    ? collectDescendantIds(activeGroup.value.items, editingDictionaryItemId.value)
    : new Set<string>()
  if (editingDictionaryItemId.value) disabledIds.add(editingDictionaryItemId.value)
  return flattenDictionaryOptions(activeGroup.value.items).map((option) => ({
    ...option,
    disabled: disabledIds.has(option.item.dictionary_item_id),
  }))
})

watch(groups, () => {
  // 刷新后保持当前分组；分组不存在时选择第一项，避免右侧展示过期数据。
  if (groups.value.some((group) => group.dictionary_code === activeDictionaryCode.value)) return
  activeDictionaryCode.value = groups.value[0]?.dictionary_code || ''
})

watch(() => props.currentUser.role, () => {
  // 登录用户角色在页面存续期间变化时重新做前端权限校验。
  if (props.currentUser.role !== 'admin') emit('forbidden')
})

function emptyGroupForm(): DictionaryGroupFormState { // 创建空的分组及首项表单
  return {
    dictionaryCode: '',
    dictionaryName: '',
    itemCode: '',
    itemName: '',
    sortOrder: 0,
    enabled: true,
    description: '',
    metadataText: '{}',
  }
}

function emptyItemForm(): DictionaryItemFormState { // 创建空的字典项表单
  return {
    itemCode: '',
    itemName: '',
    parentItemId: '',
    sortOrder: 0,
    enabled: true,
    description: '',
    metadataText: '{}',
  }
}

function ensureAdmin(): boolean { // 页面挂载和请求前都校验管理员角色
  if (props.currentUser.role !== 'admin') {
    emit('forbidden')
    return false
  }
  return true
}

function handleRequestError(error: unknown, fallbackMessage: string): void { // 统一处理接口错误，403 交给应用壳回首页
  if (error instanceof HttpError && error.status === 403) {
    ElMessage.warning('当前账号没有字典管理权限')
    emit('forbidden')
    return
  }
  ElMessage.error(error instanceof Error ? error.message : fallbackMessage)
}

async function loadDictionaries(): Promise<void> { // 查询全部字典分组并保持当前选择
  if (!ensureAdmin() || loading.value) return
  loading.value = true
  try {
    groups.value = await listDictionaries()
  } catch (error) {
    handleRequestError(error, '字典列表读取失败')
  } finally {
    loading.value = false
  }
}

function flattenDictionaryItems(items: DictionaryItemResponse[]): DictionaryItemResponse[] { // 递归拉平字典树用于统计
  return items.flatMap((item) => [item, ...flattenDictionaryItems(item.children || [])])
}

function flattenDictionaryOptions(
  items: DictionaryItemResponse[],
  depth = 0,
): Array<Omit<DictionaryParentOption, 'disabled'>> { // 递归生成保留层级的父项选项
  return items.flatMap((item) => [
    { item, depth },
    ...flattenDictionaryOptions(item.children || [], depth + 1),
  ])
}

function collectDescendantIds(
  items: DictionaryItemResponse[],
  parentId: string,
): Set<string> { // 收集指定字典项的全部后代 ID
  const descendants = new Set<string>()
  const parent = flattenDictionaryItems(items).find((item) => item.dictionary_item_id === parentId)
  const visit = (children: DictionaryItemResponse[]) => {
    children.forEach((child) => {
      descendants.add(child.dictionary_item_id)
      visit(child.children || [])
    })
  }
  visit(parent?.children || [])
  return descendants
}

function itemCount(group: DictionaryGroupResponse): number { // 统计分组内所有层级的字典项数量
  return flattenDictionaryItems(group.items).length
}

function selectGroup(group: DictionaryGroupResponse): void { // 切换右侧正在管理的字典分组
  activeDictionaryCode.value = group.dictionary_code
}

function openCreateGroupDialog(): void { // 打开新增分组及首项表单
  editingDictionaryGroupCode.value = ''
  groupForm.value = emptyGroupForm()
  groupDialogVisible.value = true
}

function openEditGroupDialog(group: DictionaryGroupResponse): void { // 打开仅允许修改分组名称的表单
  editingDictionaryGroupCode.value = group.dictionary_code
  groupForm.value = {
    ...emptyGroupForm(),
    dictionaryCode: group.dictionary_code,
    dictionaryName: group.dictionary_name,
  }
  groupDialogVisible.value = true
}

function parseMetadata(metadataText: string): Record<string, unknown> { // 解析 metadata JSON，并拒绝数组或基础类型
  const source = metadataText.trim()
  if (!source) return {}
  const parsed = JSON.parse(source) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('扩展元数据必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

async function saveDictionaryGroup(): Promise<void> { // 新增分组时用首项一次 POST，修改时只提交分组名称
  if (!ensureAdmin() || groupSaving.value) return
  const form = groupForm.value
  if (!form.dictionaryCode.trim() || !form.dictionaryName.trim()) {
    ElMessage.warning('请填写字典编码和字典名称')
    return
  }
  if (!editingDictionaryGroupCode.value && (!form.itemCode.trim() || !form.itemName.trim())) {
    ElMessage.warning('新增分组必须同时填写首项编码和名称')
    return
  }

  groupSaving.value = true
  try {
    if (editingDictionaryGroupCode.value) {
      await updateDictionaryGroup(editingDictionaryGroupCode.value, {
        dictionary_name: form.dictionaryName.trim(),
      })
      ElMessage.success('字典分组名称已更新')
    } else {
      await createDictionaryItem({
        dictionary_code: form.dictionaryCode.trim(),
        dictionary_name: form.dictionaryName.trim(),
        item_code: form.itemCode.trim(),
        item_name: form.itemName.trim(),
        parent_item_id: null,
        sort_order: Number(form.sortOrder) || 0,
        enabled: form.enabled,
        description: form.description.trim() || null,
        metadata: parseMetadata(form.metadataText),
      })
      activeDictionaryCode.value = form.dictionaryCode.trim()
      ElMessage.success('字典分组及首项已创建')
    }
    groupDialogVisible.value = false
    await loadDictionaries()
  } catch (error) {
    handleRequestError(error, '字典分组保存失败')
  } finally {
    groupSaving.value = false
  }
}

function openCreateItemDialog(): void { // 在当前分组下打开新增字典项表单
  if (!activeGroup.value) return
  editingDictionaryItemId.value = ''
  itemForm.value = emptyItemForm()
  itemDialogVisible.value = true
}

function openEditItemDialog(item: DictionaryItemResponse): void { // 用当前字典项数据打开修改表单
  editingDictionaryItemId.value = item.dictionary_item_id
  itemForm.value = {
    itemCode: item.item_code,
    itemName: item.item_name,
    parentItemId: item.parent_item_id || '',
    sortOrder: item.sort_order,
    enabled: item.enabled,
    description: item.description || '',
    metadataText: JSON.stringify(item.metadata || {}, null, 2),
  }
  itemDialogVisible.value = true
}

async function saveDictionaryItem(): Promise<void> { // 保存当前分组下的新增或修改字典项
  if (!ensureAdmin() || itemSaving.value || !activeGroup.value) return
  const form = itemForm.value
  if (!form.itemCode.trim() || !form.itemName.trim()) {
    ElMessage.warning('请填写字典项编码和名称')
    return
  }

  itemSaving.value = true
  try {
    const commonPayload = {
      item_code: form.itemCode.trim(),
      item_name: form.itemName.trim(),
      parent_item_id: form.parentItemId || null,
      sort_order: Number(form.sortOrder) || 0,
      enabled: form.enabled,
      description: form.description.trim() || null,
      metadata: parseMetadata(form.metadataText),
    }
    if (editingDictionaryItemId.value) {
      await updateDictionaryItem(editingDictionaryItemId.value, commonPayload)
      ElMessage.success('字典项已更新')
    } else {
      await createDictionaryItem({
        dictionary_code: activeGroup.value.dictionary_code,
        dictionary_name: activeGroup.value.dictionary_name,
        ...commonPayload,
      })
      ElMessage.success('字典项已新增')
    }
    itemDialogVisible.value = false
    await loadDictionaries()
  } catch (error) {
    handleRequestError(error, '字典项保存失败')
  } finally {
    itemSaving.value = false
  }
}

function actionKey(action: string, itemId: string): string { // 生成行级操作 loading 标识
  return `${action}:${itemId}`
}

async function toggleDictionaryItemEnabled(item: DictionaryItemResponse, enabled: boolean): Promise<void> { // 切换字典项启停状态
  if (!ensureAdmin()) return
  activeAction.value = actionKey('enabled', item.dictionary_item_id)
  try {
    await setDictionaryItemEnabled(item.dictionary_item_id, enabled)
    ElMessage.success(enabled ? '字典项已启用' : '字典项已停用')
    await loadDictionaries()
  } catch (error) {
    handleRequestError(error, '字典项状态更新失败')
  } finally {
    activeAction.value = ''
  }
}

async function confirmIrreversible(message: string, title: string): Promise<boolean> { // 删除前显示明确的不可逆确认提示
  try {
    await ElMessageBox.confirm(
      `${message} 此操作不可恢复。`,
      title,
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
      },
    )
    return true
  } catch {
    return false
  }
}

async function handleDeleteDictionaryItem(item: DictionaryItemResponse): Promise<void> { // 物理删除单个字典项
  const removesGroup = activeGroup.value ? itemCount(activeGroup.value) === 1 : false
  const groupRemovalNotice = removesGroup ? '删除后该分组将同时消失。' : ''
  const confirmed = await confirmIrreversible(
    `确定删除字典项「${item.item_name}」吗？${groupRemovalNotice}存在子项时请先调整层级。`,
    '删除字典项',
  )
  if (!confirmed || !ensureAdmin()) return

  activeAction.value = actionKey('delete', item.dictionary_item_id)
  try {
    await deleteDictionaryItem(item.dictionary_item_id)
    ElMessage.success('字典项已删除')
    await loadDictionaries()
  } catch (error) {
    handleRequestError(error, '字典项删除失败')
  } finally {
    activeAction.value = ''
  }
}

async function handleDeleteDictionaryGroup(group: DictionaryGroupResponse): Promise<void> { // 物理删除分组及其全部字典项
  const confirmed = await confirmIrreversible(
    `确定删除分组「${group.dictionary_name}」及其中 ${itemCount(group)} 个字典项吗？`,
    '删除字典分组',
  )
  if (!confirmed || !ensureAdmin()) return

  activeAction.value = `group:${group.dictionary_code}`
  try {
    await deleteDictionaryGroup(group.dictionary_code)
    ElMessage.success('字典分组已删除')
    await loadDictionaries()
  } catch (error) {
    handleRequestError(error, '字典分组删除失败')
  } finally {
    activeAction.value = ''
  }
}

function metadataSummary(metadata: Record<string, unknown>): string { // 把 metadata 压缩成表格内可扫描的文本
  const content = JSON.stringify(metadata || {})
  return content.length > 72 ? `${content.slice(0, 69)}...` : content
}

onMounted(() => {
  // 页面首次打开时先做管理员自校验，再加载字典数据。
  if (ensureAdmin()) void loadDictionaries()
})
</script>

<template>
  <section class="dictionary-management-page">
    <header class="dictionary-page-header">
      <div>
        <span class="dictionary-page-eyebrow"><BookKey :size="15" /> 系统配置</span>
        <h2>字典管理</h2>
        <p>维护业务枚举、层级选项及扩展元数据。</p>
      </div>
      <div class="dictionary-header-actions">
        <el-button :icon="RefreshCw" :loading="loading" @click="loadDictionaries">刷新</el-button>
        <el-button type="primary" :icon="CirclePlus" @click="openCreateGroupDialog">新增分组及首项</el-button>
      </div>
    </header>

    <div class="dictionary-summary-band">
      <div><span>字典分组</span><strong>{{ groups.length }}</strong></div>
      <div><span>字典项</span><strong>{{ totalItemCount }}</strong></div>
      <div><span>当前分组启用</span><strong>{{ activeEnabledCount }}</strong></div>
    </div>

    <div class="dictionary-workspace">
      <aside class="dictionary-group-panel">
        <div class="dictionary-panel-toolbar">
          <strong>分组</strong>
          <el-input v-model="groupKeyword" clearable placeholder="搜索名称或编码">
            <template #prefix><Search :size="15" /></template>
          </el-input>
        </div>

        <div v-loading="loading" class="dictionary-group-list">
          <button
            v-for="group in filteredGroups"
            :key="group.dictionary_code"
            class="dictionary-group-row"
            :class="{ active: group.dictionary_code === activeDictionaryCode }"
            type="button"
            @click="selectGroup(group)"
          >
            <span><BookKey :size="17" /></span>
            <div>
              <strong>{{ group.dictionary_name }}</strong>
              <code>{{ group.dictionary_code }}</code>
            </div>
            <em>{{ itemCount(group) }}</em>
            <ChevronRight :size="16" />
          </button>
          <el-empty v-if="!loading && filteredGroups.length === 0" description="暂无匹配字典" :image-size="72" />
        </div>
      </aside>

      <main class="dictionary-item-panel">
        <template v-if="activeGroup">
          <div class="dictionary-item-header">
            <div>
              <span>当前分组</span>
              <h3>{{ activeGroup.dictionary_name }}</h3>
              <code>{{ activeGroup.dictionary_code }}</code>
            </div>
            <div class="dictionary-item-actions">
              <el-button :icon="Pencil" @click="openEditGroupDialog(activeGroup)">修改名称</el-button>
              <el-button type="primary" :icon="CirclePlus" @click="openCreateItemDialog">新增字典项</el-button>
              <el-button
                type="danger"
                plain
                :icon="Trash2"
                :loading="activeAction === `group:${activeGroup.dictionary_code}`"
                @click="handleDeleteDictionaryGroup(activeGroup)"
              >
                删除分组
              </el-button>
            </div>
          </div>

          <div class="dictionary-table-wrap">
            <el-table
              :data="activeGroup.items"
              row-key="dictionary_item_id"
              default-expand-all
              :tree-props="{ children: 'children' }"
              empty-text="当前分组暂无字典项"
            >
              <el-table-column prop="item_name" label="名称" min-width="150" />
              <el-table-column prop="item_code" label="编码" min-width="150" />
              <el-table-column prop="item_level" label="层级" width="72" align="center" />
              <el-table-column prop="sort_order" label="排序" width="72" align="center" />
              <el-table-column label="启用" width="88" align="center">
                <template #default="{ row }">
                  <el-switch
                    :model-value="row.enabled"
                    :loading="activeAction === actionKey('enabled', row.dictionary_item_id)"
                    @change="toggleDictionaryItemEnabled(row, Boolean($event))"
                  />
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" min-width="170" show-overflow-tooltip />
              <el-table-column label="Metadata" min-width="220" show-overflow-tooltip>
                <template #default="{ row }"><code>{{ metadataSummary(row.metadata) }}</code></template>
              </el-table-column>
              <el-table-column label="操作" width="146" fixed="right">
                <template #default="{ row }">
                  <div class="dictionary-row-actions">
                    <el-button text type="primary" @click="openEditItemDialog(row)">编辑</el-button>
                    <el-button
                      text
                      type="danger"
                      :loading="activeAction === actionKey('delete', row.dictionary_item_id)"
                      @click="handleDeleteDictionaryItem(row)"
                    >
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
        <el-empty v-else description="请选择或新增字典分组" />
      </main>
    </div>

    <el-dialog
      v-model="groupDialogVisible"
      :title="editingDictionaryGroupCode ? '修改字典分组' : '新增分组及首项'"
      width="680px"
      append-to-body
      destroy-on-close
    >
      <el-alert
        v-if="editingDictionaryGroupCode"
        title="仅可修改分组名称，编码和所属字典项不会改变。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-form class="dictionary-editor-form" label-position="top">
        <div class="dictionary-form-grid">
          <el-form-item label="字典编码" required>
            <el-input
              v-model="groupForm.dictionaryCode"
              :disabled="Boolean(editingDictionaryGroupCode)"
              placeholder="例如：chat_model"
            />
          </el-form-item>
          <el-form-item label="字典名称" required>
            <el-input v-model="groupForm.dictionaryName" placeholder="例如：聊天模型" />
          </el-form-item>
        </div>

        <template v-if="!editingDictionaryGroupCode">
          <el-divider content-position="left">首个字典项</el-divider>
          <div class="dictionary-form-grid">
            <el-form-item label="首项编码" required>
              <el-input v-model="groupForm.itemCode" placeholder="例如：qwen_plus" />
            </el-form-item>
            <el-form-item label="首项名称" required>
              <el-input v-model="groupForm.itemName" placeholder="例如：通义千问 Plus" />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="groupForm.sortOrder" :min="0" controls-position="right" />
            </el-form-item>
            <el-form-item label="状态">
              <el-switch v-model="groupForm.enabled" active-text="启用" inactive-text="停用" />
            </el-form-item>
          </div>
          <el-form-item label="说明">
            <el-input v-model="groupForm.description" placeholder="可选，说明该字典项用途" />
          </el-form-item>
          <el-form-item label="扩展元数据 JSON">
            <el-input
              v-model="groupForm.metadataText"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              placeholder='例如：{"default": true}'
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSaving" @click="saveDictionaryGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="itemDialogVisible"
      :title="editingDictionaryItemId ? '修改字典项' : '新增字典项'"
      width="700px"
      append-to-body
      destroy-on-close
    >
      <div v-if="activeGroup" class="dictionary-dialog-context">
        <span>{{ activeGroup.dictionary_name }}</span>
        <code>{{ activeGroup.dictionary_code }}</code>
      </div>
      <el-form class="dictionary-editor-form" label-position="top">
        <div class="dictionary-form-grid">
          <el-form-item label="字典项编码" required>
            <el-input v-model="itemForm.itemCode" placeholder="同一分组内唯一" />
          </el-form-item>
          <el-form-item label="字典项名称" required>
            <el-input v-model="itemForm.itemName" placeholder="用于界面展示" />
          </el-form-item>
          <el-form-item label="父级字典项">
            <el-select v-model="itemForm.parentItemId" clearable filterable placeholder="不选择则为一级项">
              <el-option label="无父级" value="" />
              <el-option
                v-for="option in dictionaryParentOptions"
                :key="option.item.dictionary_item_id"
                :label="`${'—'.repeat(option.depth)} ${option.item.item_name}（${option.item.item_code}）`"
                :value="option.item.dictionary_item_id"
                :disabled="option.disabled"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="itemForm.sortOrder" :min="0" controls-position="right" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="itemForm.enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="itemForm.description" />
          </el-form-item>
        </div>
        <el-form-item label="扩展元数据 JSON">
          <el-input
            v-model="itemForm.metadataText"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 10 }"
            placeholder='例如：{"collection_name": "agent"}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="itemSaving" @click="saveDictionaryItem">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.dictionary-management-page {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  color: var(--text);
}

.dictionary-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 4px 2px 0;
}

.dictionary-page-header h2,
.dictionary-item-header h3 {
  margin: 4px 0 0;
  letter-spacing: 0;
}

.dictionary-page-header h2 {
  font-size: 24px;
}

.dictionary-page-header p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.dictionary-page-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.dictionary-header-actions,
.dictionary-item-actions,
.dictionary-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dictionary-summary-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.dictionary-summary-band > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 11px 16px;
  border-right: 1px solid var(--line);
}

.dictionary-summary-band > div:last-child {
  border-right: 0;
}

.dictionary-summary-band span {
  color: var(--text-muted);
  font-size: 12px;
}

.dictionary-summary-band strong {
  font-size: 18px;
}

.dictionary-workspace {
  display: grid;
  grid-template-columns: minmax(230px, 290px) minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.dictionary-group-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  border-right: 1px solid var(--line);
  background: var(--surface-2);
}

.dictionary-panel-toolbar {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid var(--line);
}

.dictionary-panel-toolbar strong {
  font-size: 13px;
}

.dictionary-group-list {
  min-height: 0;
  padding: 8px;
  overflow: auto;
}

.dictionary-group-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto 18px;
  gap: 9px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  margin-bottom: 4px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.dictionary-group-row:hover,
.dictionary-group-row.active {
  border-color: color-mix(in srgb, var(--primary) 34%, var(--line));
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
}

.dictionary-group-row > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 11%, var(--surface));
}

.dictionary-group-row div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.dictionary-group-row strong,
.dictionary-group-row code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dictionary-group-row strong {
  font-size: 13px;
}

.dictionary-group-row code,
.dictionary-group-row em {
  color: var(--text-muted);
  font-size: 11px;
  font-style: normal;
}

.dictionary-item-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  padding: 16px;
}

.dictionary-item-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
}

.dictionary-item-header > div:first-child {
  display: grid;
  gap: 3px;
}

.dictionary-item-header span,
.dictionary-item-header code {
  color: var(--text-muted);
  font-size: 12px;
}

.dictionary-table-wrap {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.dictionary-dialog-context {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text-soft);
  background: var(--surface-2);
}

.dictionary-editor-form {
  margin-top: 14px;
}

.dictionary-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

:deep(.el-table) {
  --el-table-bg-color: var(--surface);
  --el-table-tr-bg-color: var(--surface);
  --el-table-header-bg-color: var(--surface-2);
  --el-table-border-color: var(--line);
  --el-table-text-color: var(--text-soft);
  --el-table-header-text-color: var(--text);
}

:deep(.el-input-number),
:deep(.el-select) {
  width: 100%;
}

@media (max-width: 900px) {
  .dictionary-management-page {
    grid-template-rows: auto auto auto;
  }

  .dictionary-page-header,
  .dictionary-item-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .dictionary-workspace {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .dictionary-group-panel {
    max-height: 320px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .dictionary-item-panel {
    min-height: 460px;
  }
}

@media (max-width: 600px) {
  .dictionary-summary-band,
  .dictionary-form-grid {
    grid-template-columns: 1fr;
  }

  .dictionary-summary-band > div {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .dictionary-summary-band > div:last-child {
    border-bottom: 0;
  }

  .dictionary-header-actions,
  .dictionary-item-actions {
    width: 100%;
  }
}
</style>
