import { request } from './http'
import type {
  HealthResponse,
  StatusChangeResponse,
  SystemMenuPayload,
  SystemMenuResponse,
  SystemRoleCreatePayload,
  SystemRoleListResponse,
  SystemRoleMenuResponse,
  SystemRoleOptionResponse,
  SystemRoleResponse,
  SystemRoleUpdatePayload,
  SystemUserCreatePayload,
  SystemUserListResponse,
  SystemUserResponse,
  SystemUserUpdatePayload,
} from './types'

export function fetchHealth() { // 获取后端和 Qdrant 健康状态
  return request<HealthResponse>('/health') // GET /health，返回 HealthResponse
}

export function listCurrentUserMenus() { // 查询当前登录用户可见的左侧菜单树
  return request<SystemMenuResponse[]>('/system/menus/me')
}

export function listAllSystemMenus(includeDisabled = false) { // 查询全部菜单树，用于角色授权和菜单管理
  const query = includeDisabled ? '?include_disabled=true' : ''
  return request<SystemMenuResponse[]>(`/system/menus${query}`)
}

export function createSystemMenu(payload: SystemMenuPayload) { // 创建系统菜单
  return request<SystemMenuResponse>('/system/menus', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSystemMenu(menuId: string, payload: SystemMenuPayload) { // 修改系统菜单
  return request<SystemMenuResponse>(`/system/menus/${encodeURIComponent(menuId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function disableSystemMenu(menuId: string) { // 禁用系统菜单
  return request<StatusChangeResponse>(`/system/menus/${encodeURIComponent(menuId)}`, { method: 'DELETE' })
}

export function deleteSystemMenu(menuId: string) { // 物理删除系统菜单
  return request<StatusChangeResponse>(`/system/menus/${encodeURIComponent(menuId)}/delete`, { method: 'DELETE' })
}

export function enableSystemMenu(menuId: string) { // 启用系统菜单
  return request<StatusChangeResponse>(`/system/menus/${encodeURIComponent(menuId)}/enable`, { method: 'POST' })
}

export function listSystemUsers(params: {
  page: number
  pageSize: number
  keyword?: string
  role?: string
  status?: string
}) { // 分页查询系统用户
  const query = buildPaginationQuery({
    page: params.page,
    page_size: params.pageSize,
    keyword: params.keyword,
    role: params.role,
    status: params.status,
  })
  return request<SystemUserListResponse>(`/system/users?${query}`)
}

export function createSystemUser(payload: SystemUserCreatePayload) { // 创建系统用户
  return request<SystemUserResponse>('/system/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSystemUser(userId: string, payload: SystemUserUpdatePayload) { // 修改系统用户
  return request<SystemUserResponse>(`/system/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function resetSystemUserPassword(userId: string, password: string) { // 重置系统用户密码
  return request<{ status: string; user_id: string }>(`/system/users/${encodeURIComponent(userId)}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function disableSystemUser(userId: string) { // 禁用系统用户
  return request<StatusChangeResponse>(`/system/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

export function deleteSystemUser(userId: string) { // 物理删除系统用户
  return request<StatusChangeResponse>(`/system/users/${encodeURIComponent(userId)}/delete`, { method: 'DELETE' })
}

export function enableSystemUser(userId: string) { // 启用系统用户
  return request<StatusChangeResponse>(`/system/users/${encodeURIComponent(userId)}/enable`, { method: 'POST' })
}

export function listSystemRoles(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: string
}) { // 分页查询系统角色
  const query = buildPaginationQuery({
    page: params.page,
    page_size: params.pageSize,
    keyword: params.keyword,
    status: params.status,
  })
  return request<SystemRoleListResponse>(`/system/roles?${query}`)
}

export function listSystemRoleOptions() { // 查询启用角色下拉选项
  return request<SystemRoleOptionResponse[]>('/system/roles/options')
}

export function createSystemRole(payload: SystemRoleCreatePayload) { // 创建系统角色
  return request<SystemRoleResponse>('/system/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSystemRole(roleId: string, payload: SystemRoleUpdatePayload) { // 修改系统角色
  return request<SystemRoleResponse>(`/system/roles/${encodeURIComponent(roleId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function disableSystemRole(roleId: string) { // 禁用系统角色
  return request<StatusChangeResponse>(`/system/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' })
}

export function deleteSystemRole(roleId: string) { // 物理删除系统角色
  return request<StatusChangeResponse>(`/system/roles/${encodeURIComponent(roleId)}/delete`, { method: 'DELETE' })
}

export function enableSystemRole(roleId: string) { // 启用系统角色
  return request<StatusChangeResponse>(`/system/roles/${encodeURIComponent(roleId)}/enable`, { method: 'POST' })
}

export function getSystemRoleMenus(roleId: string) { // 查询角色菜单授权
  return request<SystemRoleMenuResponse>(`/system/roles/${encodeURIComponent(roleId)}/menus`)
}

export function saveSystemRoleMenus(roleId: string, menuIds: string[]) { // 覆盖保存角色菜单授权
  return request<SystemRoleMenuResponse>(`/system/roles/${encodeURIComponent(roleId)}/menus`, {
    method: 'PUT',
    body: JSON.stringify({ menu_ids: menuIds }),
  })
}

function buildPaginationQuery(params: Record<string, string | number | undefined>) {
  // 统一过滤空查询参数，避免后端收到 role=&status= 这类无意义条件。
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    query.set(key, String(value))
  })
  return query.toString()
}
