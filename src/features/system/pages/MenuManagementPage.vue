<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Edit3, Eye, EyeOff, Menu, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createSystemMenu,
  deleteSystemMenu,
  disableSystemMenu,
  enableSystemMenu,
  listAllSystemMenus,
  updateSystemMenu,
  type SystemMenuPayload,
  type SystemMenuResponse,
} from '../../../shared/api'

interface MenuFormState { // 菜单新增和编辑弹窗表单
  parentMenuId: string
  menuCode: string
  menuName: string
  menuType: string
  pageKey: string
  routePath: string
  componentKey: string
  icon: string
  permissionCode: string
  sortOrder: number
  visible: boolean
  status: string
  subLabel: string
}

const loading = ref(false)
const saving = ref(false)
const activeAction = ref('')
const menus = ref<SystemMenuResponse[]>([])
const keyword = ref('')
const menuDialogVisible = ref(false)
const editingMenuId = ref('')
const menuForm = reactive<MenuFormState>({
  parentMenuId: '',
  menuCode: '',
  menuName: '',
  menuType: 'page',
  pageKey: '',
  routePath: '',
  componentKey: '',
  icon: 'Menu',
  permissionCode: '',
  sortOrder: 0,
  visible: true,
  status: 'active',
  subLabel: '',
})

const dialogTitle = computed(() => editingMenuId.value ? '编辑菜单' : '新增菜单')
const filteredMenus = computed(() => filterMenuTree(menus.value, keyword.value.trim()))
const parentOptions = computed(() => flattenMenus(menus.value).filter((menu) => menu.menu_id !== editingMenuId.value))
const menuTypeOptions = [
  { label: '目录', value: 'directory' },
  { label: '页面', value: 'page' },
]

function statusLabel(status: string) {
  if (status === 'active') return '启用'
  if (status === 'disabled') return '禁用'
  return status
}

function menuTypeLabel(menuType: string) {
  if (menuType === 'directory') return '目录'
  if (menuType === 'page') return '页面'
  return menuType
}

function actionKey(action: string, menuId: string) {
  return `${action}:${menuId}`
}

function isCoreSystemMenu(menu: SystemMenuResponse) {
  return ['system', 'userManagement', 'roleManagement', 'menuManagement'].includes(menu.menu_code)
}

function flattenMenus(items: SystemMenuResponse[]) {
  // 把菜单树拍平成下拉选项，同时保留层级缩进文本。
  const result: Array<SystemMenuResponse & { optionLabel: string }> = []
  const visit = (nodes: SystemMenuResponse[], level: number) => {
    for (const node of nodes) {
      result.push({ ...node, optionLabel: `${'　'.repeat(level)}${node.menu_name}` })
      visit(node.children || [], level + 1)
    }
  }
  visit(items, 0)
  return result
}

function filterMenuTree(items: SystemMenuResponse[], cleanKeyword: string): SystemMenuResponse[] {
  // 关键词搜索时保留命中的节点和它的上级路径，避免树形结构断层。
  if (!cleanKeyword) return items
  return items
    .map((item) => {
      const children = filterMenuTree(item.children || [], cleanKeyword)
      const selfMatched = [item.menu_name, item.menu_code, item.page_key, item.permission_code]
        .some((value) => String(value || '').includes(cleanKeyword))
      return selfMatched || children.length ? { ...item, children } : null
    })
    .filter((item): item is SystemMenuResponse => Boolean(item))
}

async function loadMenus() {
  loading.value = true
  try {
    menus.value = await listAllSystemMenus(true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '菜单列表读取失败')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingMenuId.value = ''
  menuForm.parentMenuId = ''
  menuForm.menuCode = ''
  menuForm.menuName = ''
  menuForm.menuType = 'page'
  menuForm.pageKey = ''
  menuForm.routePath = ''
  menuForm.componentKey = ''
  menuForm.icon = 'Menu'
  menuForm.permissionCode = ''
  menuForm.sortOrder = 0
  menuForm.visible = true
  menuForm.status = 'active'
  menuForm.subLabel = ''
}

function openCreateDialog(parent?: SystemMenuResponse) {
  resetForm()
  if (parent) menuForm.parentMenuId = parent.menu_id
  menuDialogVisible.value = true
}

function openEditDialog(menu: SystemMenuResponse) {
  editingMenuId.value = menu.menu_id
  menuForm.parentMenuId = menu.parent_menu_id || ''
  menuForm.menuCode = menu.menu_code
  menuForm.menuName = menu.menu_name
  menuForm.menuType = menu.menu_type
  menuForm.pageKey = menu.page_key || ''
  menuForm.routePath = menu.route_path || ''
  menuForm.componentKey = menu.component_key || ''
  menuForm.icon = menu.icon || 'Menu'
  menuForm.permissionCode = menu.permission_code || ''
  menuForm.sortOrder = menu.sort_order
  menuForm.visible = menu.visible
  menuForm.status = menu.status
  menuForm.subLabel = typeof menu.metadata?.sub_label === 'string' ? menu.metadata.sub_label : ''
  menuDialogVisible.value = true
}

function buildPayload(): SystemMenuPayload | null {
  if (!menuForm.menuCode.trim() || !menuForm.menuName.trim()) {
    ElMessage.warning('请填写菜单编码和菜单名称')
    return null
  }
  return {
    parent_menu_id: menuForm.parentMenuId || null,
    menu_code: menuForm.menuCode.trim(),
    menu_name: menuForm.menuName.trim(),
    menu_type: menuForm.menuType,
    page_key: menuForm.pageKey.trim() || null,
    route_path: menuForm.routePath.trim() || null,
    component_key: menuForm.componentKey.trim() || null,
    icon: menuForm.icon.trim() || null,
    permission_code: menuForm.permissionCode.trim() || null,
    sort_order: menuForm.sortOrder,
    visible: menuForm.visible,
    status: menuForm.status,
    metadata: menuForm.subLabel.trim() ? { sub_label: menuForm.subLabel.trim() } : {},
  }
}

async function saveMenu() {
  const payload = buildPayload()
  if (!payload) return
  saving.value = true
  try {
    if (editingMenuId.value) {
      await updateSystemMenu(editingMenuId.value, payload)
      ElMessage.success('菜单已修改')
    } else {
      await createSystemMenu(payload)
      ElMessage.success('菜单已新增')
    }
    menuDialogVisible.value = false
    await loadMenus()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '菜单保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleMenuStatus(menu: SystemMenuResponse) {
  const nextDisabled = menu.status === 'active'
  const title = nextDisabled ? '禁用菜单' : '启用菜单'
  const message = nextDisabled ? `确认禁用菜单「${menu.menu_name}」吗？` : `确认启用菜单「${menu.menu_name}」吗？`
  try {
    await ElMessageBox.confirm(message, title, { type: nextDisabled ? 'warning' : 'info' })
    activeAction.value = actionKey(nextDisabled ? 'disable' : 'enable', menu.menu_id)
    if (nextDisabled) {
      await disableSystemMenu(menu.menu_id)
    } else {
      await enableSystemMenu(menu.menu_id)
    }
    ElMessage.success(nextDisabled ? '菜单已禁用' : '菜单已启用')
    await loadMenus()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    activeAction.value = ''
  }
}

async function deleteMenu(row: SystemMenuResponse) {
  if (isCoreSystemMenu(row)) {
    ElMessage.warning('核心系统菜单不允许删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除菜单「${row.menu_name}」吗？删除后会同步清理角色授权。`, '删除菜单', { type: 'warning' })
    activeAction.value = actionKey('delete', row.menu_id)
    await deleteSystemMenu(row.menu_id)
    ElMessage.success('菜单已删除')
    await loadMenus()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  } finally {
    activeAction.value = ''
  }
}

onMounted(() => {
  void loadMenus()
})
</script>

<template>
  <div class="system-page">
    <header class="page-hero">
      <div>
        <span class="page-kicker"><Menu :size="14" /> 系统管理</span>
        <h2>菜单管理</h2>
        <p>维护左侧菜单、页面入口、显示状态和权限编码。</p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button :icon="RefreshCw" :loading="loading" plain @click="loadMenus">刷新</el-button>
        <el-button :icon="Plus" type="primary" @click="openCreateDialog()">新增菜单</el-button>
      </div>
    </header>

    <section class="system-panel">
      <div class="system-toolbar">
        <el-input
          v-model="keyword"
          class="system-search-input"
          clearable
          placeholder="搜索菜单名称、编码或权限"
          :prefix-icon="Search"
        />
      </div>

      <el-table
        v-loading="loading"
        :data="filteredMenus"
        class="system-table"
        row-key="menu_id"
      >
        <el-table-column prop="menu_name" label="菜单名称" min-width="180" />
        <el-table-column prop="menu_code" label="菜单编码" min-width="170" show-overflow-tooltip />
        <el-table-column label="类型" width="90">
          <template #default="{ row }: { row: SystemMenuResponse }">
            <el-tag effect="plain" :type="row.menu_type === 'directory' ? 'warning' : 'primary'">{{ menuTypeLabel(row.menu_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="page_key" label="页面键" min-width="150" show-overflow-tooltip />
        <el-table-column prop="permission_code" label="权限编码" min-width="180" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column label="显示" width="90">
          <template #default="{ row }: { row: SystemMenuResponse }">
            <el-tag :type="row.visible ? 'success' : 'info'" effect="plain">
              <component :is="row.visible ? Eye : EyeOff" :size="13" />
              {{ row.visible ? '显示' : '隐藏' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: SystemMenuResponse }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="390" fixed="right">
          <template #default="{ row }: { row: SystemMenuResponse }">
            <div class="system-row-actions">
              <el-button :icon="Plus" size="small" plain @click="openCreateDialog(row)">子菜单</el-button>
              <el-button :icon="Edit3" size="small" plain @click="openEditDialog(row)">编辑</el-button>
              <el-button
                :icon="row.status === 'active' ? ShieldOff : ShieldCheck"
                size="small"
                :type="row.status === 'active' ? 'warning' : 'success'"
                plain
                :loading="activeAction === actionKey(row.status === 'active' ? 'disable' : 'enable', row.menu_id)"
                @click="toggleMenuStatus(row)"
              >
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
              <el-button
                :icon="Trash2"
                size="small"
                type="danger"
                plain
                :disabled="isCoreSystemMenu(row)"
                :loading="activeAction === actionKey('delete', row.menu_id)"
                @click="deleteMenu(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="menuDialogVisible" :title="dialogTitle" width="760px" class="system-dialog">
      <el-form class="system-form" label-position="top">
        <div class="system-form-grid">
          <el-form-item label="父级菜单">
            <el-select v-model="menuForm.parentMenuId" clearable filterable placeholder="一级菜单">
              <el-option v-for="item in parentOptions" :key="item.menu_id" :label="item.optionLabel" :value="item.menu_id" />
            </el-select>
          </el-form-item>
          <el-form-item label="菜单类型">
            <el-select v-model="menuForm.menuType">
              <el-option v-for="item in menuTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="菜单编码">
            <el-input v-model="menuForm.menuCode" placeholder="例如：menuManagement" />
          </el-form-item>
          <el-form-item label="菜单名称">
            <el-input v-model="menuForm.menuName" placeholder="例如：菜单管理" />
          </el-form-item>
          <el-form-item label="页面键">
            <el-input v-model="menuForm.pageKey" placeholder="例如：menuManagement" />
          </el-form-item>
          <el-form-item label="路由路径">
            <el-input v-model="menuForm.routePath" placeholder="例如：/system/menus" />
          </el-form-item>
          <el-form-item label="组件键">
            <el-input v-model="menuForm.componentKey" placeholder="例如：MenuManagementPage" />
          </el-form-item>
          <el-form-item label="图标">
            <el-input v-model="menuForm.icon" placeholder="例如：Menu" />
          </el-form-item>
          <el-form-item label="权限编码">
            <el-input v-model="menuForm.permissionCode" placeholder="例如：system:menu:manage" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="menuForm.sortOrder" :min="0" :step="1" controls-position="right" />
          </el-form-item>
          <el-form-item label="左侧展示">
            <el-switch v-model="menuForm.visible" active-text="显示" inactive-text="隐藏" inline-prompt />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="menuForm.status" active-value="active" inactive-value="disabled" active-text="启用" inactive-text="禁用" inline-prompt />
          </el-form-item>
        </div>
        <el-form-item label="副标题">
          <el-input v-model="menuForm.subLabel" placeholder="例如：菜单配置" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="menuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMenu">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
