import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const styleSource = readFileSync(join(root, 'src/style.css'), 'utf8')

function findRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`)
  const match = source.match(rulePattern)
  if (!match?.groups?.body) {
    throw new Error(`未找到样式规则：${selector}`)
  }
  return match.groups.body
}

const treeRule = findRule(styleSource, '.system-menu-permission .el-tree')
if (!/background:\s*color-mix\(in srgb,\s*var\(--surface\)\s*86%,\s*transparent\)/.test(treeRule)) {
  throw new Error('菜单权限树控件不能使用 Element Plus 默认白底，需要适配暗色背景')
}
if (!/color:\s*var\(--text\)/.test(treeRule)) {
  throw new Error('菜单权限树控件需要使用系统正文颜色，避免暗色主题文字发灰或不可读')
}
if (!/border:\s*1px solid var\(--line\)/.test(treeRule)) {
  throw new Error('菜单权限树控件需要和弹窗保持一致边框')
}

const nodeRule = findRule(styleSource, '.system-menu-permission .el-tree-node__content')
if (!/border-radius:\s*8px/.test(nodeRule)) {
  throw new Error('菜单权限树节点需要圆角点击区，避免默认树节点样式突兀')
}

const hoverRule = findRule(styleSource, '.system-menu-permission .el-tree-node__content:hover')
if (!/background:\s*color-mix\(in srgb,\s*var\(--primary\)\s*14%,\s*transparent\)/.test(hoverRule)) {
  throw new Error('菜单权限树节点 hover 需要暗色主题背景反馈')
}

console.log('系统菜单权限弹窗暗色树样式契约检查通过')
