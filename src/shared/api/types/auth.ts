export interface AuthUser { // 当前登录用户，来自后端 `/auth/me`
  user_id: string
  username: string
  display_name: string
  role: string
  status: string
}

export interface LoginPayload { // 登录请求体
  username: string
  password: string
}

export interface LoginResponse { // 登录成功后的 token 和用户信息
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}
