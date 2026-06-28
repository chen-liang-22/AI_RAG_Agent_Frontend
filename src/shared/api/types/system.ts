export interface SystemMenuResponse { // 系统菜单树节点，ID 一律保持字符串避免雪花 ID 精度丢失
  menu_id: string
  parent_menu_id?: string | null
  menu_code: string
  menu_name: string
  menu_type: string
  page_key?: string | null
  route_path?: string | null
  component_key?: string | null
  icon?: string | null
  permission_code?: string | null
  sort_order: number
  visible: boolean
  status: string
  metadata: Record<string, unknown>
  children: SystemMenuResponse[]
}

export interface SystemMenuPayload { // 新增或修改系统菜单请求
  parent_menu_id?: string | null
  menu_code?: string
  menu_name?: string
  menu_type?: string
  page_key?: string | null
  route_path?: string | null
  component_key?: string | null
  icon?: string | null
  permission_code?: string | null
  sort_order?: number
  visible?: boolean
  status?: string
  metadata?: Record<string, unknown>
}

export interface SystemUserResponse { // 系统用户列表项，不包含密码哈希
  user_id: string
  username: string
  display_name: string
  role: string
  status: string
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

export interface SystemUserListResponse { // 系统用户分页响应
  items: SystemUserResponse[]
  total: number
  page: number
  page_size: number
}

export interface SystemUserCreatePayload { // 创建系统用户请求
  username: string
  display_name: string
  password: string
  role: string
  status: string
}

export interface SystemUserUpdatePayload { // 修改系统用户请求
  display_name?: string
  password?: string
  role?: string
  status?: string
}

export interface SystemRoleResponse { // 系统角色列表项，角色 ID 保持字符串
  role_id: string
  role_code: string
  role_name: string
  status: string
  sort_order: number
  built_in: boolean
  description?: string | null
  created_at: string
  updated_at: string
}

export interface SystemRoleListResponse { // 系统角色分页响应
  items: SystemRoleResponse[]
  total: number
  page: number
  page_size: number
}

export interface SystemRoleOptionResponse { // 系统角色下拉选项
  role_code: string
  role_name: string
}

export interface SystemRoleCreatePayload { // 创建系统角色请求，可同时初始化菜单授权
  role_code: string
  role_name: string
  status: string
  sort_order: number
  description?: string | null
  menu_ids: string[]
}

export interface SystemRoleUpdatePayload { // 修改系统角色请求
  role_name?: string
  status?: string
  sort_order?: number
  description?: string | null
}

export interface SystemRoleMenuResponse { // 角色菜单授权响应
  role: SystemRoleResponse
  checked_menu_ids: string[]
  menu_tree: SystemMenuResponse[]
}

export interface StatusChangeResponse { // 启用或禁用操作响应
  status: string
  role_id?: string | null
  user_id?: string | null
  menu_id?: string | null
}
