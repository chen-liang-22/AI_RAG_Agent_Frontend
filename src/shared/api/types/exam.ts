export type ExamQuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'

export interface ExamSectionResponse { // 可用于考试的目录路径
  section_path: string // 目录路径
  question_count: number // 该目录下题目数量
}

export interface ExamSectionsResponse { // `/exam/sections` 响应结构
  collection_name: string // 向量库名称
  document_id?: string | null // 文件编号
  sections: ExamSectionResponse[] // 目录列表
}

export interface ExamStartPayload { // `/exam/sessions` 开始考试请求结构
  title: string // 本场测评名称
  collection_name?: string | null // 题源所在向量库
  document_id?: string | null // 题源文件
  section_path?: string | null // 题源目录
  user_id?: string | null // 用户编号
  round_count: number // 考试轮数
  question_types: ExamQuestionType[] // 随机题型范围
  model_mode?: string | null // 主观题分析模型档位
  seed?: number | null // 随机种子
}

export interface ExamQuestionSource { // 考试题目的知识来源信息
  document_id?: string | null // 来源文件编号
  filename?: string | null // 来源文件名
  section_path?: string | null // 来源章节路径
  source_page?: number | null // 来源页码
}

export interface ExamConversationQuestion { // 对话式考试中的当前题目
  exam_question_id: string // 本场考试内的题目编号
  round_no: number // 当前轮次
  question_type: ExamQuestionType // 题型
  prompt: string // 题目文本
  options: string[] // 选项
  max_score: number // 本题满分
  source: ExamQuestionSource // 来源信息
}

export interface ExamSessionSummary { // 考试会话摘要
  session_id: string // 考试会话编号
  user_id?: string | null // 用户编号
  title: string // 会话标题
  collection_name: string // 向量库名称
  document_id?: string | null // 文件编号
  filename?: string | null // 文件名
  section_path?: string | null // 目录路径
  round_count: number // 总轮数
  answered_count: number // 已答题数
  total_score: number // 当前总分
  max_score: number // 满分
  status: string // active/completed
  current_round: number // 当前轮次
  created_at: string // 创建时间
  updated_at: string // 更新时间
  completed_at?: string | null // 完成时间
}

export interface ExamStartResponse { // 开始考试响应结构
  session: ExamSessionSummary // 考试会话
  current_question: ExamConversationQuestion // 第一题
}

export interface ExamAnswerAnalysis { // 单题作答分析
  is_correct: boolean // 是否正确
  score: number // 本题得分
  max_score: number // 本题满分
  correct_answer: unknown // 正确答案
  reference_answer: string // 参考答案
  hit_points: string[] // 命中点
  missing_points: string[] // 遗漏点
  wrong_points: string[] // 错误点
  comment: string // 点评
}

export interface ExamAnswerResponse { // 提交答案响应结构
  session: ExamSessionSummary // 更新后的考试会话
  answered_question: ExamConversationQuestion // 已作答题目
  analysis: ExamAnswerAnalysis // 本题分析
  next_question?: ExamConversationQuestion | null // 下一题
}

export interface ExamHistoryListResponse { // 考试历史分页响应
  items: ExamSessionSummary[] // 当前页考试记录
  total: number // 总数
  page: number // 当前页
  page_size: number // 每页数量
}

export interface ExamSessionDeleteResponse { // 删除考试历史响应
  status: string // 删除结果状态
  session_id: string // 被删除的考试会话编号
}

export interface ExamQuestionRecord { // 考试详情单题记录
  question: ExamConversationQuestion // 题目
  user_answer?: string | null // 用户答案
  analysis?: ExamAnswerAnalysis | null // 分析
  answered_at?: string | null // 作答时间
}

export interface ExamSessionDetailResponse { // 考试详情响应
  session: ExamSessionSummary // 会话摘要
  questions: ExamQuestionRecord[] // 全部题目
}
