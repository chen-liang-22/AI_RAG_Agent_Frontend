import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const styleSource = readFileSync(join(root, 'src/style.css'), 'utf8')
const roleSource = readFileSync(join(root, 'src/features/system/pages/RoleManagementPage.vue'), 'utf8')

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}

assertIncludes(
  styleSource,
  '.system-table.el-table .el-table__cell.el-table-fixed-column--right',
  '系统管理表格固定操作列缺少独立背景，窄屏横向滚动时会和底层文字重叠'
)
assertIncludes(
  styleSource,
  'background-color: var(--el-table-tr-bg-color)',
  '系统管理表格固定操作列未使用不透明行背景'
)
assertIncludes(
  roleSource,
  '<el-table-column prop="description" label="说明" min-width="260" show-overflow-tooltip>',
  '角色管理说明列需要使用自定义单行省略模板'
)
assertIncludes(
  roleSource,
  'class="system-table-ellipsis"',
  '角色管理说明列或更新时间列缺少单行省略容器'
)
assertIncludes(
  roleSource,
  '<el-table-column label="操作" width="360" fixed="right"',
  '角色管理操作列过宽，笔记本宽度下容易遮挡说明和更新时间'
)

console.log('系统管理表格窄屏契约检查通过')
