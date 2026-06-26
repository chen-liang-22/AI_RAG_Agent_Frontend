import { clearAccessToken, request, setAccessToken } from './http'
import type { AuthUser, LoginPayload, LoginResponse } from './types'

export {
  AUTH_EXPIRED_EVENT,
  clearAccessToken,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from './http'

export async function login(payload: LoginPayload) {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setAccessToken(response.access_token)
  return response
}

export function fetchCurrentUser() {
  return request<AuthUser>('/auth/me')
}

export async function logoutCurrentUser() {
  const response = await request<{ status: string }>('/auth/logout', {
    method: 'POST',
  })
  clearAccessToken()
  return response
}
