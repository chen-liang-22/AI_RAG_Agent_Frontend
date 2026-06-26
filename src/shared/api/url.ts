const DEFAULT_API_PREFIX = '/api'
const V2_SUFFIX = '/v2'

function readEnvBaseUrl() {
  // Vite 会在浏览器环境里注入 import.meta.env；契约测试在 Node 里运行时没有这个对象。
  const meta = import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }
  return meta.env?.VITE_API_BASE_URL
}

export function normalizeApiBaseUrl(baseUrl?: string) {
  const rawBaseUrl = (baseUrl || readEnvBaseUrl() || DEFAULT_API_PREFIX).trim()
  const withoutTrailingSlash = rawBaseUrl.replace(/\/+$/, '')

  if (!withoutTrailingSlash) {
    return `${DEFAULT_API_PREFIX}${V2_SUFFIX}`
  }
  if (withoutTrailingSlash.endsWith(`${DEFAULT_API_PREFIX}${V2_SUFFIX}`)) {
    return withoutTrailingSlash
  }
  if (withoutTrailingSlash.endsWith(DEFAULT_API_PREFIX)) {
    return `${withoutTrailingSlash}${V2_SUFFIX}`
  }
  return `${withoutTrailingSlash}${DEFAULT_API_PREFIX}${V2_SUFFIX}`
}

export function buildApiUrl(path: string, baseUrl?: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeApiBaseUrl(baseUrl)}${normalizedPath}`
}

export const API_BASE_URL = normalizeApiBaseUrl()
