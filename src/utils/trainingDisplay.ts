// 销售训练展示工具：只放纯函数，避免页面和组件重复维护格式化逻辑。

export const PROFILE_PREVIEW_LIMIT = 20

export function hasDisplayValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.some((item) => hasDisplayValue(item))
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return String(value).trim() !== ''
}

export function objectEntries(value: Record<string, unknown> = {}): Array<[string, unknown]> {
  return Object.entries(value).filter(([, item]) => hasDisplayValue(item))
}

export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object' && value) return JSON.stringify(value, null, 2)
  return String(value ?? '')
}

export function compactText(value: string | null | undefined, limit = PROFILE_PREVIEW_LIMIT): string {
  const text = String(value || '').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}

export function valueList(value: unknown): string[] {
  if (!hasDisplayValue(value)) return []
  if (Array.isArray(value)) return value.flatMap((item) => valueList(item))
  if (typeof value === 'object' && value) {
    return objectEntries(value as Record<string, unknown>).map(([key, item]) => `${key}：${displayValue(item)}`)
  }
  return String(value).split(/\n+/).map((item) => item.trim()).filter(Boolean)
}

export function safeList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

export function reportPointList(value: unknown): string[] {
  // 训练评分报告里的命中点/遗漏点有时是对象数组，不能直接 String(item)，否则会显示 [object Object]。
  return Array.isArray(value)
    ? value.map((item) => formatReportPoint(item)).filter(Boolean)
    : []
}

export function formatReportPoint(value: unknown): string {
  if (!hasDisplayValue(value)) return ''
  if (typeof value !== 'object' || value === null) return String(value).trim()

  const source = value as Record<string, unknown>
  const title = firstDisplayValue(source, [
    'point_name',
    'name',
    'title',
    'dimension_name',
    'ability',
    'skill',
    'label',
  ])
  const detail = firstDisplayValue(source, [
    'description',
    'detail',
    'reason',
    'evidence',
    'comment',
    'suggestion',
    'advice',
    'requirement',
  ])
  const score = firstDisplayValue(source, ['score', 'deduct_score', 'max_score'])
  const level = firstDisplayValue(source, ['level', 'status'])

  const parts: string[] = []
  if (title) parts.push(title)
  if (detail && detail !== title) parts.push(detail)
  if (score) parts.push(`${score}分`)
  if (level) parts.push(level)

  return parts.length > 0 ? parts.join(' · ') : displayValue(value)
}

export function firstDisplayValue(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (hasDisplayValue(value)) return displayValue(value).trim()
  }
  return ''
}

export function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : []
}

export function uniqueList(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
}

export function displayOptionLabel(value: string, options: Record<string, string>): string {
  return options[value] || value
}
