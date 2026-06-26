import { Bot, BrainCircuit, ClipboardCheck, LayoutDashboard } from 'lucide-vue-next'

export type ThemeMode = 'dark' | 'light'
export type MainPage = 'home' | 'chat' | 'exam' | 'salesTraining'

export const portalPages = [
  { key: 'home' as const, label: '首页', subLabel: '系统驾驶舱', icon: LayoutDashboard },
  { key: 'chat' as const, label: '智能客服', subLabel: 'RAG 问答', icon: Bot },
  { key: 'salesTraining' as const, label: '销售陪练', subLabel: 'AI 客户训练', icon: BrainCircuit },
  { key: 'exam' as const, label: '问答考试', subLabel: '知识测评', icon: ClipboardCheck },
]
