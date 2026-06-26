import type { LoginResponse } from './types'
import { buildApiUrl } from './url'

export { API_BASE_URL, buildApiUrl, normalizeApiBaseUrl } from './url'

export const AUTH_EXPIRED_EVENT = 'ai-rag-agent-auth-expired'

let accessToken = ''

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = ''
}

function notifyAuthExpired() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
}

export function buildRequestHeaders(
  headers?: HeadersInit,
  includeJsonContentType = true,
  includeAuthorization = true,
) {
  const finalHeaders = new Headers()
  if (includeJsonContentType) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (headers) {
    new Headers(headers).forEach((value, key) => finalHeaders.set(key, value))
  }
  const token = getAccessToken()
  if (includeAuthorization && token) {
    // 续签重试后这里会读取最新 token，避免旧 Authorization 被重复带上。
    finalHeaders.set('Authorization', `Bearer ${token}`)
  }
  return finalHeaders
}

export async function refreshAccessToken() {
  const response = await fetch(buildApiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: buildRequestHeaders(undefined, true, false),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response)
    clearAccessToken()
    throw new Error(message)
  }
  const data = await response.json() as LoginResponse
  setAccessToken(data.access_token)
  return data
}

export async function fetchWithAuth(
  path: string,
  options?: RequestInit,
  includeJsonContentType = true,
  retryOnUnauthorized = true,
): Promise<Response> {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    credentials: 'include',
    headers: buildRequestHeaders(options?.headers, includeJsonContentType),
  })

  if (
    response.status !== 401
    || !retryOnUnauthorized
    || path.startsWith('/auth/login')
    || path.startsWith('/auth/refresh')
  ) {
    return response
  }

  try {
    await refreshAccessToken()
  } catch {
    clearAccessToken()
    notifyAuthExpired()
    return response
  }

  return fetchWithAuth(path, options, includeJsonContentType, false)
}

export async function readErrorMessage(response: Response) {
  const text = await response.text()

  if (!text) {
    return `Request failed: ${response.status}`
  }

  try {
    const data = JSON.parse(text)
    if (typeof data.detail === 'string') {
      return data.detail
    }
    if (data.detail) {
      return JSON.stringify(data.detail)
    }
  } catch {
    // 非 JSON 响应直接展示原文，便于定位代理或后端异常。
  }

  return text
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(path, options)

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  return response.json() as Promise<T>
}
