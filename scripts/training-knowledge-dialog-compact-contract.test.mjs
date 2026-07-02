import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const homeSource = readFileSync(join(root, 'src/features/dashboard/pages/HomePage.vue'), 'utf8')
const workspaceSource = readFileSync(
  join(root, 'src/features/sales-training/components/TrainingKnowledgeWorkspace.vue'),
  'utf8',
)

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}

function findRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`)
  const match = source.match(rulePattern)
  if (!match?.groups?.body) {
    throw new Error(`未找到样式规则：${selector}`)
  }
  return match.groups.body
}

function assertRuleIncludes(source, selector, expected, message) {
  const rule = findRule(source, selector)
  if (!rule.includes(expected)) {
    throw new Error(message)
  }
}

assertIncludes(
  homeSource,
  'const trainingKnowledgeDialogBatchPageSize = 5',
  '知识库管理弹窗内训练资料分页数量应使用独立常量 5，给每条资料留出更宽松空间',
)
assertIncludes(
  homeSource,
  'trainingKnowledgeDialogBatchPageSize,',
  '首页弹窗读取训练资料时应使用弹窗专用分页数量',
)
assertIncludes(
  homeSource,
  'list-density="compact"',
  '知识库管理弹窗里的训练资料工作区应启用紧凑列表模式',
)
assertIncludes(
  homeSource,
  ':page-size="trainingKnowledgeDialogBatchPageSize"',
  '训练资料分页组件应展示弹窗专用分页数量',
)
assertRuleIncludes(
  homeSource,
  '.training-knowledge-dialog-body',
  'grid-template-columns: minmax(260px, 300px) minmax(0, 1fr)',
  '知识库管理弹窗左侧上传栏需要缩窄，给已上传资料让出空间',
)
assertRuleIncludes(
  homeSource,
  '.training-knowledge-dialog-body',
  'height: min(72vh, 640px)',
  '知识库管理弹窗内容区需要更高，避免已上传资料区域拥挤',
)

assertIncludes(
  workspaceSource,
  "listDensity?: 'comfortable' | 'compact'",
  '训练资料工作区需要提供列表密度属性，避免影响销售训练主页面默认卡片布局',
)
assertIncludes(
  workspaceSource,
  'pageSize?: number',
  '训练资料工作区分页数量需要由父级传入',
)
assertIncludes(
  workspaceSource,
  ":class=\"{ 'compact-list': props.listDensity === 'compact' }\"",
  '训练资料工作区根节点需要在紧凑模式下增加 compact-list 类',
)
assertIncludes(
  workspaceSource,
  ':page-size="props.pageSize || 6"',
  '训练资料工作区默认分页数量仍应保持 6，弹窗模式由父级覆盖',
)
assertRuleIncludes(
  workspaceSource,
  '.training-knowledge-workspace.compact-list .training-batch-list',
  'grid-template-columns: 1fr',
  '紧凑模式下已上传资料需要从三列卡片改为单列列表',
)
assertRuleIncludes(
  workspaceSource,
  '.training-knowledge-workspace.compact-list .training-batch-item',
  'grid-template-areas:',
  '紧凑模式下资料条目需要用区域布局压缩信息和操作按钮',
)
assertRuleIncludes(
  workspaceSource,
  '.training-knowledge-workspace.compact-list .batch-action-row',
  'width: 210px',
  '紧凑模式下操作按钮区需要固定宽度，避免挤压文件名和质量信息',
)
assertRuleIncludes(
  workspaceSource,
  '.training-knowledge-workspace.compact-list .training-batch-item',
  'min-height: 96px',
  '紧凑模式下资料条目仍需要保留宽松行高，避免信息贴得太紧',
)

console.log('知识库管理弹窗训练资料紧凑列表契约检查通过')
