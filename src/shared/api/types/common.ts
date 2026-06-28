export interface HealthResponse { // `/health` 接口返回的数据结构
  status: string // 后端整体状态，例如 ok/degraded
  qdrant: string // Qdrant 状态，例如 ok/unavailable
  collection_name: string // 当前使用的 Qdrant collection 名称
  collections: string[] // Qdrant 中已有的 collection 列表
  collection_points: Record<string, number> // 每个 Qdrant collection 的真实向量点数量
}
