export interface GraphHealthResponse { // Neo4j 知识图谱健康检查响应
  status: string // ok/unavailable/disabled
  message: string // 后端返回的中文状态说明
  details: Record<string, unknown> // 地址、数据库、耗时等排查信息，不包含密码
}

export interface GraphCountItem { // 图谱统计中的单项分布
  label?: string // 节点标签，例如 Document/Chunk/Entity
  type?: string // 关系类型，例如 HAS_CHUNK/MENTIONS
  count: number // 当前标签或关系类型的数量
}

export interface GraphOverviewResponse { // Neo4j 图谱概览响应
  status: string // ok/disabled
  node_count: number // 节点总数
  relationship_count: number // 关系总数
  labels: GraphCountItem[] // 节点标签分布
  relationship_types: GraphCountItem[] // 关系类型分布
  documents: GraphDocumentSummary[] // 最近写入图谱的文件节点
}

export interface GraphDocumentSummary { // 已进入 Neo4j 图谱的文件摘要
  document_id: string // 文件编号
  filename: string // 原始文件名
  collection_name: string // Qdrant collection 名称
  source: string // knowledge 或 training
  document_type: string // 文档结构类型
  split_strategy: string // 切片策略
  updated_at: string // 图谱更新时间
  chunk_count: number // 文件包含的切片数量
}

export interface GraphDocumentListResponse { // 图谱文件名查询响应
  status: string // ok/disabled
  documents: GraphDocumentSummary[] // 匹配到的文件
  total: number // 返回数量
  keyword: string // 查询关键词
  message?: string // 中文提示
}

export interface GraphNodeItem { // 文件图谱中的节点
  label: string // 节点类型，例如 Document、Chunk、Entity
  properties: Record<string, unknown> // Neo4j 节点属性
}

export interface GraphRelationshipItem { // 文件图谱中的关系
  type: string // 关系类型，例如 HAS_CHUNK、MENTIONS
  source: string // 起点节点标识
  target: string // 终点节点标识
}

export interface GraphDocumentResponse { // 单个文件的图谱详情
  status: string // ok/disabled/not_found/failed
  document_id: string // 文件编号
  nodes: GraphNodeItem[] // 文件、切片、实体节点
  relationships: GraphRelationshipItem[] // 节点之间的关系
  message?: string // 空数据或异常时的中文说明
}
