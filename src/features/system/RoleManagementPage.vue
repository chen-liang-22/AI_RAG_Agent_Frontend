<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Edit3, KeyRound, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox, type TreeInstance } from 'element-plus'
import {
  createSystemRole,
  deleteSystemRole,
  disableSystemRole,
  enableSystemRole,
  getSystemRoleMenus,
  listSystemRoles,
  saveSystemRoleMenus,
  updateSystemRole,
  type SystemMenuResponse,
  type SystemRoleCreatePayload,
  type SystemRoleResponse,
  type SystemRoleUpdatePayload,
} from '../../shared/api'

interface RoleFormState { // 角色新增和编辑弹窗表单
  roleCode: string
  roleName: string
  status: string
  sortOrder: number
  description: string
}

interface MenuTreeNode { // Element Plus 菜单树节点
  id: string
  label: string
  disabled: boolean
  children: MenuTreeNode[]
}

const loading = ref(false)
const saving = ref(false)
const permissionLoading = ref(false)
const permissionSaving = ref(false)
const activeAction = ref('')
const roles = ref<SystemRoleResponse[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const statusFilter = ref('')
const roleDialogVisible = ref(false)
const permissionDialogVisible = ref(false)
const editingRoleId = ref('')
const permissionRole = ref<SystemRoleResponse | null>(null)
const menuTree = ref<SystemMenuResponse[]>([])
const checkedMenuIds = ref<string[]>([])
const menuTreeRef = ref<TreeInstance>()
const roleForm = reactive<RoleFormState>({
  roleCode: '',
  roleName: '',
  status: 'active',
  sortOrder: 0,
  description: '',
})

const dialogTitle = computed(() => editingRoleId.value ? '编辑角色' : '新增角色')
const menuTreeData = computed(() => menuTree.value.map((menu) => toMenuTreeNode(menu, permissionRole.value?.role_code === 'admin')))
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

function statusLabel(status: string) {
  if (status === 'active') return '启用'
  if (status === 'disabled') return '禁用'
  return status
}

function actionKey(action: string, roleId: string) {
  return `${action}:${roleId}`
}

function toMenuTreeNode(menu: SystemMenuResponse, lockAdminCore: boolean): MenuTreeNode {
  const isAdminCore = lockAdminCore && ['system', 'roleManagement', 'menuManagement'].includes(menu.menu_code)
  return {
    id: menu.menu_id,
    label: menu.menu_name,
    disabled: isAdminCore,
    children: (menu.children || []).map((child) => toMenuTreeNode(child, lockAdminCore)),
  }
}

async function loadRoles() {
  loading.value = true
  try {
    const response = await listSystemRoles({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
    })
    roles.value = response.items
    total.value = response.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '角色列表读取失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingRoleId.value = ''
  roleForm.roleCode = ''
  roleForm.roleName = ''
  roleForm.status = 'active'
  roleForm.sortOrder = 0
  roleForm.description = ''
}

function openCreateDialog() {
  resetForm()
  roleDialogVisible.value = true
}

function openEditDialog(role: SystemRoleResponse) {
  editingRoleId.value = role.role_id
  roleForm.roleCode = role.role_code
  roleForm.roleName = role.role_name
  roleForm.status = role.status
  roleForm.sortOrder = role.sort_order
  roleForm.description = role.description || ''
  roleDialogVisible.value = true
}

function buildCreatePayload(): SystemRoleCreatePayload | null {
  if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
    ElMessage.warning('请填写角色编码和角色名称')
    return null
  }
  return {
    role_code: roleForm.roleCode.trim(),
    role_name: roleForm.roleName.trim(),
    status: roleForm.status,
    sort_order: roleForm.sortOrder,
    description: roleForm.description.trim() || null,
    menu_ids: [],
  }
}

function buildUpdatePayload(): SystemRoleUpdatePayload | null {
  if (!roleForm.roleName.trim()) {
    ElMessage.warning('请填写角色名称')
    return null
  }
  return {
    role_name: roleForm.roleName.trim(),
    status: roleForm.status,
    sort_order: roleForm.sortOrder,
    description: roleForm.description.trim() || null,
  }
}

async function saveRole() {
  saving.value = true
  try {
    if (editingRoleId.value) {
      const payload = buildUpdatePayload()
      if (!payload) return
      await updateExistingRole(editingRoleId.value, payload)
      ElMessage.success('角色已修改')
    } else {
      const payload = buildCreatePayload()
      if (!payload) return
      await createSystemRole(payload)
      ElMessage.success('角色已新增')
    }
    roleDialogVisible.value = false
    await loadRoles()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '角色保存失败')
  } finally {
    saving.value = false
  }
}

async function updateExistingRole(roleId: string, payload: SystemRoleUpdatePayload) {
  // 单独封装更新动作，保持 saveRole 的新增和修改分支易读。
  return updateSystemRole(roleId, payload)
}

async function toggleRoleStatus(role: SystemRoleResponse) {
  if (role.built_in && role.status === 'active') {
    ElMessage.warning('内置角色不允许禁用')
    return
  }
  const nextDisabled = role.status === 'active'
  const title = nextDisabled ? '禁用角色' : '启用角色'
  const message = nextDisabled ? `确认禁用角色「${role.role_name}」吗？` : `确认启用角色「${role.role_name}」吗？`
  try {
    await ElMessageBox.confirm(message, title, { type: nextDisabled ? 'warning' : 'info' })
    activeAction.value = actionKey(nextDisabled ? 'disable' : 'enable', role.role_id)
    if (nextDisabled) {
      await disableSystemRole(role.role_id)
    } else {
      await enableSystemRole(role.role_id)
    }
    ElMessage.success(nextDisabled ? '角色已禁用' : '角色已启用')
    await loadRoles()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    activeAction.value = ''
  }
}

async function deleteRole(role: SystemRoleResponse) {
  if (role.built_in) {
    ElMessage.warning('内置角色不允许删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除角色「${role.role_name}」吗？删除后会同步清理该角色的菜单授权。`, '删除角色', { type: 'warning' })
    activeAction.value = actionKey('delete', role.role_id)
    await deleteSystemRole(role.role_id)
    ElMessage.success('角色已删除')
    await loadRoles()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    activeAction.value = ''
  }
}

async function openPermissionDialog(role: SystemRoleResponse) {
  permissionRole.value = role
  permissionDialogVisible.value = true
  permissionLoading.value = true
  try {
    const response = await getSystemRoleMenus(role.role_id)
    menuTree.value = response.menu_tree
    checkedMenuIds.value = normalizeCheckedMenuIds(role, response.checked_menu_ids, response.menu_tree)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '菜单权限读取失败')
  } finally {
    permissionLoading.value = false
  }
}

function normalizeCheckedMenuIds(role: SystemRoleResponse, menuIds: string[], menus: SystemMenuResponse[]) {
  if (role.role_code !== 'admin') return menuIds
  const coreIds = collectCoreAdminMenuIds(menus)
  return Array.from(new Set([...menuIds, ...coreIds]))
}

function collectCoreAdminMenuIds(menus: SystemMenuResponse[]) {
  const result: string[] = []
  const visit = (items: SystemMenuResponse[]) => {
    for (const item of items) {
      if (['system', 'roleManagement', 'menuManagement'].includes(item.menu_code)) result.push(item.menu_id)
      visit(item.children || [])
    }
  }
  visit(menus)
  return result
}

async function savePermissions() {
  if (!permissionRole.value) return
  permissionSaving.value = true
  try {
    const checkedKeys = menuTreeRef.value?.getCheckedKeys(false) || []
    const halfCheckedKeys = menuTreeRef.value?.getHalfCheckedKeys() || []
    const menuIds = Array.from(new Set([...checkedKeys, ...halfCheckedKeys].map(String)))
    const finalMenuIds = permissionRole.value.role_code === 'admin'
      ? Array.from(new Set([...menuIds, ...collectCoreAdminMenuIds(menuTree.value)]))
      : menuIds
    await saveSystemRoleMenus(permissionRole.value.role_id, finalMenuIds)
    checkedMenuIds.value = finalMenuIds
    ElMessage.success('菜单权限已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '菜单权限保存失败')
  } finally {
    permissionSaving.value = false
  }
}

function handleSearch() {
  page.value = 1
  void loadRoles()
}

function handlePageSizeChange() {
  page.value = 1
  void loadRoles()
}

onMounted(() => {
  void loadRoles()
})
</script>

<template>
  <div class="system-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><ShieldCheck :size="14" /> 系统管理</span>
        <h2>角色管理</h2>
        <p>维护角色、启用状态和左侧菜单授权。</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button :icon="RefreshCw" :loading="loading" plain @click="loadRoles">刷新</el-button>
        <el-button :icon="Plus" type="primary" @click="openCreateDialog">新增角色</el-button>
      </div>
    </header>

    <section class="system-panel">
      <div class="system-toolbar">
        <el-input
          v-model="keyword"
          class="system-search-input"
          clearable
          placeholder="搜索角色编码或名称"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select v-model="statusFilter" clearable placeholder="全部状态" @change="handleSearch">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" plain :icon="Search" @click="handleSearch">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="roles" class="system-table" row-key="role_id">
        <el-table-column prop="role_name" label="角色名称" min-width="150" />
        <el-table-column prop="role_code" label="角色编码" min-width="150" />
        <el-table-column prop="sort_order" label="排序" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: SystemRoleResponse }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }: { row: SystemRoleResponse }">
            <el-tag :type="row.built_in ? 'warning' : 'primary'" effect="plain">{{ row.built_in ? '内置' : '自定义' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
        <el-table-column prop="updated_at" label="更新时间" min-width="170" show-overflow-tooltip />
        <el-table-column label="操作" width="400" fixed="right">
          <template #default="{ row }: { row: SystemRoleResponse }">
            <div class="system-row-actions">
              <el-button :icon="Edit3" size="small" plain @click="openEditDialog(row)">编辑</el-button>
              <el-button :icon="KeyRound" size="small" plain @click="openPermissionDialog(row)">菜单</el-button>
              <el-button
                :icon="row.status === 'active' ? ShieldOff : ShieldCheck"
                size="small"
                :type="row.status === 'active' ? 'warning' : 'success'"
                plain
                :disabled="row.built_in && row.status === 'active'"
                :loading="activeAction === actionKey(row.status === 'active' ? 'disable' : 'enable', row.role_id)"
                @click="toggleRoleStatus(row)"
              >
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
              <el-button
                :icon="Trash2"
                size="small"
                type="danger"
                plain
                :disabled="row.built_in"
                :loading="activeAction === actionKey('delete', row.role_id)"
                @click="deleteRole(row)"
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
          @current-change="loadRoles"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="roleDialogVisible" :title="dialogTitle" width="680px" class="system-dialog">
      <el-form class="system-form" label-position="top">
        <div class="system-form-grid">
          <el-form-item label="角色编码">
            <el-input v-model="roleForm.roleCode" :disabled="Boolean(editingRoleId)" placeholder="例如：trainer_admin" />
          </el-form-item>
          <el-form-item label="角色名称">
            <el-input v-model="roleForm.roleName" placeholder="例如：训练管理员" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="roleForm.sortOrder" :min="0" :step="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="roleForm.status" active-value="active" inactive-value="disabled" active-text="启用" inactive-text="禁用" inline-prompt />
          </el-form-item>
        </div>
        <el-form-item label="说明">
          <el-input v-model="roleForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="permissionDialogVisible" title="菜单权限" width="620px" class="system-dialog">
      <div v-loading="permissionLoading" class="system-menu-permission">
        <div v-if="permissionRole" class="system-permission-header">
          <strong>{{ permissionRole.role_name }}</strong>
          <span>{{ permissionRole.role_code }}</span>
        </div>
        <el-tree
          ref="menuTreeRef"
          node-key="id"
          show-checkbox
          :data="menuTreeData"
          :default-checked-keys="checkedMenuIds"
          :props="{ label: 'label', children: 'children', disabled: 'disabled' }"
        />
      </div>
      <template #footer>
        <el-button :disabled="permissionSaving" @click="permissionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="permissionSaving" @click="savePermissions">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
