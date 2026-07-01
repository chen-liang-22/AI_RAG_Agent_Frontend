import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pageSource = readFileSync(
  join(root, 'src/features/sales-training/pages/SalesTrainingPage.vue'),
  'utf8',
)

// 校验指定选择器的样式规则，保证低高度视口下底部操作区不会被裁剪。
function findRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`)
  const match = source.match(rulePattern)
  if (!match?.groups?.body) {
    throw new Error(`未找到样式规则：${selector}`)
  }
  return match.groups.body
}

const rightPanelRule = findRule(pageSource, '.training-right-panel')
if (!/padding-bottom:\s*max\(16px,\s*env\(safe-area-inset-bottom\)\)/.test(rightPanelRule)) {
  throw new Error('右侧面板缺少底部安全留白，低高度窗口下底部区域可能点击不到')
}

const customerPanelRule = findRule(pageSource, '.training-right-panel .customer-profile-panel')
if (!/overflow:\s*auto/.test(customerPanelRule)) {
  throw new Error('客户画像面板需要允许内部滚动，避免内容被视口锁定裁剪')
}
if (!/scrollbar-gutter:\s*stable/.test(customerPanelRule)) {
  throw new Error('客户画像面板滚动条需要稳定占位，避免滚动出现时挤压内容')
}

const actionRowRule = findRule(pageSource, '.training-right-panel .customer-profile-panel .training-action-row')
if (/bottom:\s*-/.test(actionRowRule)) {
  throw new Error('客户画像操作区不能使用负数 bottom，否则底部按钮会被裁剪')
}
if (/margin:\s*[^;]*-[0-9][^;]*;/.test(actionRowRule)) {
  throw new Error('客户画像操作区不能使用负数 margin，否则底部点击区域会被父容器裁掉')
}
if (!/bottom:\s*0/.test(actionRowRule)) {
  throw new Error('客户画像操作区需要贴合可滚动容器底部')
}
if (!/padding:\s*10px 13px calc\(13px \+ env\(safe-area-inset-bottom\)\)/.test(actionRowRule)) {
  throw new Error('客户画像操作区缺少安全区内边距，底部按钮可能贴到窗口边缘')
}

console.log('销售训练右侧客户画像底部可点击布局契约检查通过')
