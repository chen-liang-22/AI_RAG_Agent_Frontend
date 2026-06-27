<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Edit3, KeyRound, Plus, RefreshCw, Search, Trash2, UserCheck, UserX } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createSystemUser,
  deleteSystemUser,
  disableSystemUser,
  enableSystemUser,
  listSystemRoleOptions,
  listSystemUsers,
  resetSystemUserPassword,
  updateSystemUser,
  type AuthUser,
  type SystemRoleOptionResponse,
  type SystemUserCreatePayload,
  type SystemUserResponse,
  type SystemUserUpdatePayload,
} from '../../shared/api'

const props = defineProps<{
  currentUser: AuthUser
}>()

interface UserFormState { // 用户新增和编辑弹窗表单
  username: string
  displayName: string
  password: string
  role: string
  status: string
}

const loading = ref(false)
const saving = ref(false)
const resettingPassword = ref(false)
const activeAction = ref('')
const users = ref<SystemUserResponse[]>([])
const roles = ref<SystemRoleOptionResponse[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const userDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const editingUserId = ref('')
const resetPasswordUser = ref<SystemUserResponse | null>(null)
const resetPasswordValue = ref('')
const userForm = reactive<UserFormState>({
  username: '',
  displayName: '',
  password: '',
  role: 'user',
  status: 'active',
})

const dialogTitle = computed(() => editingUserId.value ? '编辑用户' : '新增用户')
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

function roleName(roleCode: string) {
  return roles.value.find((role) => role.role_code === roleCode)?.role_name || roleCode
}

function statusLabel(status: string) {
  if (status === 'active') return '启用'
  if (status === 'disabled') return '禁用'
  return status
}

function actionKey(action: string, userId: string) {
  return `${action}:${userId}`
}

async function loadUsers() {
  loading.value = true
  try {
    const response = await listSystemUsers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      role: roleFilter.value || undefined,
      status: statusFilter.value || undefined,
    })
    users.value = response.items
    total.value = response.total
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '用户列表读取失败')
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  try {
    roles.value = await listSystemRoleOptions()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '角色选项读取失败')
  }
}

function resetForm() {
  editingUserId.value = ''
  userForm.username = ''
  userForm.displayName = ''
  userForm.password = ''
  userForm.role = roles.value[0]?.role_code || 'user'
  userForm.status = 'active'
}

function openCreateDialog() {
  resetForm()
  userDialogVisible.value = true
}

function openEditDialog(user: SystemUserResponse) {
  editingUserId.value = user.user_id
  userForm.username = user.username
  userForm.displayName = user.display_name
  userForm.password = ''
  userForm.role = user.role
  userForm.status = user.status
  userDialogVisible.value = true
}

function buildCreatePayload(): SystemUserCreatePayload | null {
  if (!userForm.username.trim() || !userForm.displayName.trim()) {
    ElMessage.warning('请填写登录账号和用户姓名')
    return null
  }
  if (!editingUserId.value && userForm.password.trim().length < 6) {
    ElMessage.warning('初始密码至少 6 位')
    return null
  }
  return {
    username: userForm.username.trim(),
    display_name: userForm.displayName.trim(),
    password: userForm.password,
    role: userForm.role,
    status: userForm.status,
  }
}

function buildUpdatePayload(): SystemUserUpdatePayload | null {
  if (!userForm.displayName.trim()) {
    ElMessage.warning('请填写用户姓名')
    return null
  }
  const payload: SystemUserUpdatePayload = {
    display_name: userForm.displayName.trim(),
    role: userForm.role,
    status: userForm.status,
  }
  if (userForm.password.trim()) {
    if (userForm.password.trim().length < 6) {
      ElMessage.warning('密码至少 6 位')
      return null
    }
    payload.password = userForm.password
  }
  return payload
}

async function saveUser() {
  saving.value = true
  try {
    if (editingUserId.value) {
      const payload = buildUpdatePayload()
      if (!payload) return
      await updateSystemUser(editingUserId.value, payload)
      ElMessage.success('用户已修改')
    } else {
      const payload = buildCreatePayload()
      if (!payload) return
      await createSystemUser(payload)
      ElMessage.success('用户已新增')
    }
    userDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '用户保存失败')
  } finally {
    saving.value = false
  }
}

function openPasswordDialog(user: SystemUserResponse) {
  resetPasswordUser.value = user
  resetPasswordValue.value = ''
  passwordDialogVisible.value = true
}

async function savePassword() {
  if (!resetPasswordUser.value) return
  if (resetPasswordValue.value.trim().length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  resettingPassword.value = true
  try {
    await resetSystemUserPassword(resetPasswordUser.value.user_id, resetPasswordValue.value)
    ElMessage.success('密码已重置')
    passwordDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '密码重置失败')
  } finally {
    resettingPassword.value = false
  }
}

async function toggleUserStatus(user: SystemUserResponse) {
  const nextDisabled = user.status === 'active'
  if (nextDisabled && user.user_id === props.currentUser.user_id) {
    ElMessage.warning('不能禁用当前登录用户')
    return
  }
  const title = nextDisabled ? '禁用用户' : '启用用户'
  const message = nextDisabled ? `确认禁用用户「${user.display_name}」吗？` : `确认启用用户「${user.display_name}」吗？`
  try {
    await ElMessageBox.confirm(message, title, { type: nextDisabled ? 'warning' : 'info' })
    activeAction.value = actionKey(nextDisabled ? 'disable' : 'enable', user.user_id)
    if (nextDisabled) {
      await disableSystemUser(user.user_id)
    } else {
      await enableSystemUser(user.user_id)
    }
    ElMessage.success(nextDisabled ? '用户已禁用' : '用户已启用')
    await loadUsers()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    activeAction.value = ''
  }
}

async function deleteUser(row: SystemUserResponse) {
  if (row.user_id === props.currentUser.user_id) {
    ElMessage.warning('不能删除当前登录用户')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.display_name}」吗？删除后不可在列表中恢复。`, '删除用户', { type: 'warning' })
    activeAction.value = actionKey('delete', row.user_id)
    await deleteSystemUser(row.user_id)
    ElMessage.success('用户已删除')
    await loadUsers()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    activeAction.value = ''
  }
}

function handleSearch() {
  page.value = 1
  void loadUsers()
}

function handlePageSizeChange() {
  page.value = 1
  void loadUsers()
}

onMounted(async () => {
  await loadRoles()
  await loadUsers()
})
</script>

<template>
  <div class="system-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><UserCheck :size="14" /> 系统管理</span>
        <h2>用户管理</h2>
        <p>维护登录账号、角色归属和启用状态。</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button :icon="RefreshCw" :loading="loading" plain @click="loadUsers">刷新</el-button>
        <el-button :icon="Plus" type="primary" @click="openCreateDialog">新增用户</el-button>
      </div>
    </header>

    <section class="system-panel">
      <div class="system-toolbar">
        <el-input
          v-model="keyword"
          class="system-search-input"
          clearable
          placeholder="搜索账号或姓名"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select v-model="roleFilter" clearable placeholder="全部角色" @change="handleSearch">
          <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
        </el-select>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" @change="handleSearch">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" plain :icon="Search" @click="handleSearch">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="users" class="system-table" row-key="user_id">
        <el-table-column prop="username" label="登录账号" min-width="150" />
        <el-table-column prop="display_name" label="用户姓名" min-width="150" />
        <el-table-column label="角色" min-width="130">
          <template #default="{ row }: { row: SystemUserResponse }">
            <el-tag effect="plain" type="primary">{{ roleName(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: SystemUserResponse }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="最后登录" min-width="170" show-overflow-tooltip />
        <el-table-column prop="updated_at" label="更新时间" min-width="170" show-overflow-tooltip />
        <el-table-column label="操作" width="390" fixed="right">
          <template #default="{ row }: { row: SystemUserResponse }">
            <div class="system-row-actions">
              <el-button :icon="Edit3" size="small" plain @click="openEditDialog(row)">编辑</el-button>
              <el-button :icon="KeyRound" size="small" plain @click="openPasswordDialog(row)">密码</el-button>
              <el-button
                :icon="row.status === 'active' ? UserX : UserCheck"
                size="small"
                :type="row.status === 'active' ? 'warning' : 'success'"
                plain
                :disabled="row.user_id === currentUser.user_id && row.status === 'active'"
                :loading="activeAction === actionKey(row.status === 'active' ? 'disable' : 'enable', row.user_id)"
                @click="toggleUserStatus(row)"
              >
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
              <el-button
                :icon="Trash2"
                size="small"
                type="danger"
                plain
                :disabled="row.user_id === currentUser.user_id"
                :loading="activeAction === actionKey('delete', row.user_id)"
                @click="deleteUser(row)"
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
          @current-change="loadUsers"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="userDialogVisible" :title="dialogTitle" width="680px" class="system-dialog">
      <el-form class="system-form" label-position="top">
        <div class="system-form-grid">
          <el-form-item label="登录账号">
            <el-input v-model="userForm.username" :disabled="Boolean(editingUserId)" placeholder="例如：zhangsan" />
          </el-form-item>
          <el-form-item label="用户姓名">
            <el-input v-model="userForm.displayName" placeholder="例如：张三" />
          </el-form-item>
          <el-form-item :label="editingUserId ? '新密码' : '初始密码'">
            <el-input v-model="userForm.password" type="password" show-password :placeholder="editingUserId ? '不填则不修改' : '至少 6 位'" />
          </el-form-item>
          <el-form-item label="角色">
            <el-select v-model="userForm.role" filterable>
              <el-option v-for="role in roles" :key="role.role_code" :label="role.role_name" :value="role.role_code" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="userForm.status" active-value="active" inactive-value="disabled" active-text="启用" inactive-text="禁用" inline-prompt />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="460px" class="system-dialog">
      <el-form label-position="top">
        <el-form-item :label="resetPasswordUser ? `用户：${resetPasswordUser.display_name}` : '用户'">
          <el-input v-model="resetPasswordValue" type="password" show-password placeholder="请输入新密码，至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="resettingPassword" @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resettingPassword" @click="savePassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
