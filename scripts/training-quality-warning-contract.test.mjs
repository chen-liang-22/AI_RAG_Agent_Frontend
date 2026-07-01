import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const workspaceSource = readFileSync(
  join(root, 'src/features/sales-training/components/TrainingKnowledgeWorkspace.vue'),
  'utf8',
)

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}

assertIncludes(
  workspaceSource,
  'openQualityWarningDialog(batch)',
  '资料卡片的告警标签没有绑定点击查看原因',
)
assertIncludes(
  workspaceSource,
  'qualityWarningDialogVisible',
  '缺少质量告警弹窗状态',
)
assertIncludes(
  workspaceSource,
  '质量告警',
  '缺少质量告警弹窗标题',
)
assertIncludes(
  workspaceSource,
  '<button',
  '告警入口应使用按钮，保证可点击和键盘访问',
)

console.log('训练资料质量告警入口契约检查通过')
