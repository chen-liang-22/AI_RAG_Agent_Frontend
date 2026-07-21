export interface PromptVariable { // 提示词模板变量
  name: string
}

export interface PromptResponse { // 提示词详情和列表项
  prompt_id: string
  prompt_key: string
  prompt_code: string
  domain: string
  prompt_name: string
  prompt_type: string
  content: string
  variables: PromptVariable[]
  model_name: string | null
  description?: string | null
  enabled: boolean
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

export interface PromptListResponse { // 提示词分页列表响应
  items: PromptResponse[]
  total: number
  page: number
  page_size: number
}

export interface PromptCreatePayload { // 新增提示词请求
  prompt_key: string
  prompt_code: string
  domain: string
  prompt_name: string
  prompt_type: string
  content: string
  variables: PromptVariable[]
  model_name: string | null
  description?: string | null
  enabled: boolean
}

export interface PromptUpdatePayload { // 修改提示词请求，不允许修改提示词键
  prompt_code: string
  domain: string
  prompt_name: string
  prompt_type: string
  content: string
  variables: PromptVariable[]
  model_name: string | null
  description?: string | null
  enabled: boolean
}

export interface PromptDeleteResponse { // 删除提示词响应
  status: string
  prompt_key: string
}
