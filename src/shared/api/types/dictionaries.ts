export interface DictionaryItemResponse { // 后端字典项，children 支持多层级展示
  dictionary_item_id: string // 字典项唯一 ID
  dictionary_code: string // 字典编码
  dictionary_name: string // 字典名称
  item_code: string // 字典项编码
  item_name: string // 字典项名称
  parent_item_id?: string | null // 父级字典项 ID
  item_level: number // 字典项层级
  sort_order: number // 同级排序号
  enabled: boolean // 是否启用
  description?: string | null // 字典项说明
  metadata: Record<string, unknown> // 前端展示或业务扩展元数据
  children: DictionaryItemResponse[] // 子级字典项
}

export interface DictionaryGroupResponse { // 后端按 dictionary_code 分组后的字典
  dictionary_code: string // 字典编码
  dictionary_name: string // 字典名称
  items: DictionaryItemResponse[] // 树形字典项
}

export interface DictionaryGroupPayload { // 新增或修改父级字典的请求结构
  dictionary_code?: string // 新增时必填：父级字典编码
  dictionary_name: string // 父级字典名称
}

export interface DictionaryItemPayload { // 新增或修改字典项的请求结构
  dictionary_code?: string // 新增时必填：字典编码
  dictionary_name?: string // 字典名称
  item_code?: string // 字典项编码
  item_name?: string // 字典项名称
  parent_item_id?: string | null // 父级字典项 ID
  sort_order?: number // 排序号
  enabled?: boolean // 是否启用
  description?: string | null // 说明
  metadata?: Record<string, unknown> // 扩展元数据
}
