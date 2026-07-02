import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const reviewSource = readFileSync(
  join(root, 'src/features/sales-training/components/TrainingReviewWorkspace.vue'),
  'utf8',
)

function findRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`)
  const match = source.match(rulePattern)
  if (!match?.groups?.body) {
    throw new Error(`未找到样式规则：${selector}`)
  }
  return match.groups.body
}

const workspaceRule = findRule(reviewSource, '.training-review-workspace')
if (!/height:\s*100%/.test(workspaceRule)) {
  throw new Error('复盘工作区需要占满父级高度，否则评分报告会按内容高度撑出视口')
}
if (!/min-height:\s*0/.test(workspaceRule)) {
  throw new Error('复盘工作区需要允许在网格容器内收缩，避免底部被父级裁剪')
}
if (!/overflow:\s*hidden/.test(workspaceRule)) {
  throw new Error('复盘工作区应由内部面板滚动，不能把滚动泄露到页面外层')
}
if (!/align-items:\s*stretch/.test(workspaceRule)) {
  throw new Error('历史面板和评分报告面板需要拉伸到同一可用高度')
}

const panelRule = findRule(reviewSource, '.training-panel')
if (!/display:\s*grid/.test(panelRule)) {
  throw new Error('复盘面板需要使用网格布局分配标题和内容区域')
}
if (!/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/.test(panelRule)) {
  throw new Error('复盘面板需要把内容区限制在剩余高度内')
}
if (!/min-height:\s*0/.test(panelRule)) {
  throw new Error('复盘面板需要允许内容区收缩')
}

const scorePanelRule = findRule(reviewSource, '.score-panel')
if (!/overflow-y:\s*auto/.test(scorePanelRule)) {
  throw new Error('评分报告面板需要内部纵向滚动，长报告不能被卡片裁掉')
}
if (!/scrollbar-gutter:\s*stable/.test(scorePanelRule)) {
  throw new Error('评分报告面板滚动条需要稳定占位，避免内容宽度抖动')
}
if (!/padding-bottom:\s*max\(16px,\s*env\(safe-area-inset-bottom\)\)/.test(scorePanelRule)) {
  throw new Error('评分报告面板需要底部安全留白，保证最后一段内容完整可见')
}

const historyPanelRule = findRule(reviewSource, '.history-panel')
if (!/min-height:\s*0/.test(historyPanelRule)) {
  throw new Error('历史面板需要允许列表在内部滚动')
}

const historyListRule = findRule(reviewSource, '.training-history-list')
if (!/min-height:\s*0/.test(historyListRule)) {
  throw new Error('历史列表需要允许在面板剩余高度内收缩')
}
if (!/max-height:\s*none/.test(historyListRule)) {
  throw new Error('历史列表不应保留固定最大高度，否则不同视口下会浪费或挤压复盘区域')
}
if (!/scrollbar-gutter:\s*stable/.test(historyListRule)) {
  throw new Error('历史列表滚动条需要稳定占位')
}

console.log('销售训练复盘工作区滚动布局契约检查通过')
