import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pageSource = readFileSync(
  join(root, 'src/features/sales-training/pages/SalesTrainingPage.vue'),
  'utf8',
)

// 校验指定选择器的样式规则，保证销售训练配置页画像摘要保持横条布局。
function findRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`)
  const match = source.match(rulePattern)
  if (!match?.groups?.body) {
    throw new Error(`未找到样式规则：${selector}`)
  }
  return match.groups.body
}

function findLastRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 'g')
  const matches = [...source.matchAll(rulePattern)]
  const match = matches.at(-1)
  if (!match?.groups?.body) {
    throw new Error(`未找到样式规则：${selector}`)
  }
  return match.groups.body
}

const workspaceRule = findRule(pageSource, '.training-workspace')
if (/minmax\(720px,\s*1fr\)/.test(workspaceRule) || /minmax\(360px,\s*420px\)/.test(workspaceRule)) {
  throw new Error('训练配置区不能使用 720px/360px 硬最小宽度，否则 1920 宽视口下会挤压主工作区')
}
if (!/grid-template-areas:\s*"main"/.test(workspaceRule)) {
  throw new Error('训练配置区应回到单主区布局，画像横条不能再占用左右侧栏')
}
const normalizedWorkspaceRule = workspaceRule.replace(/\s+/g, ' ')
if (/grid-template-areas:\s*"main side"\s*"context side"/.test(normalizedWorkspaceRule)) {
  throw new Error('训练配置区不能继续使用 main/side/context 三块布局')
}
if (!/grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(workspaceRule)) {
  throw new Error('训练配置区主工作区需要横向拉满')
}

const mainPanelRule = findLastRule(pageSource, '.training-main-panel')
if (!/grid-area:\s*main/.test(mainPanelRule)) {
  throw new Error('角色场景主工作区需要占用 main 区域')
}
if (!/min-width:\s*0/.test(mainPanelRule)) {
  throw new Error('画像横条迁入主区后，主工作区不能再保留 760px 硬最小宽度')
}

const heroStart = pageSource.indexOf('<header class="page-hero sales-training-hero"')
const heroEnd = pageSource.indexOf('</header>', heroStart)
if (heroStart < 0 || heroEnd < 0) {
  throw new Error('未找到销售训练顶部标题区域')
}
const heroSource = pageSource.slice(heroStart, heroEnd)
if (heroSource.includes('向量库 sales_training_cases') || heroSource.includes('向导式创建') || heroSource.includes('文字训练')) {
  throw new Error('顶部标题区不应继续展示向量库、向导式创建、文字训练三个说明 chip')
}
if (!/class="hero-active-plan"/.test(heroSource)) {
  throw new Error('当前训练摘要需要移动到顶部标题右侧空位')
}
if (/class="training-panel active-plan-brief"/.test(pageSource)) {
  throw new Error('当前训练摘要不应继续占用下方内容区卡片')
}

if (/class="training-left-panel"/.test(pageSource)) {
  throw new Error('学员画像不应继续放在左侧面板')
}
if (/class="training-right-panel"/.test(pageSource)) {
  throw new Error('客户画像不应继续放在右侧面板')
}
if (/class="training-panel customer-profile-panel profile-summary-panel"/.test(pageSource)) {
  throw new Error('客户画像不应继续使用大卡片摘要面板')
}

const mainStart = pageSource.indexOf('<section class="training-main-panel">')
const tabsStart = pageSource.indexOf('<section class="setup-flow-tabs"', mainStart)
const stripStart = pageSource.indexOf('class="profile-summary-strip"', tabsStart)
const contentStart = pageSource.indexOf('<section class="setup-flow-content">', tabsStart)
if (mainStart < 0 || tabsStart < 0 || stripStart < 0 || contentStart < 0 || !(tabsStart < stripStart && stripStart < contentStart)) {
  throw new Error('学员画像和客户画像横条必须放在步骤栏下方、配置内容上方')
}
if (!/class="profile-summary-bar trainee"/.test(pageSource)) {
  throw new Error('缺少学员画像横条')
}
if (!/class="profile-summary-bar customer"/.test(pageSource)) {
  throw new Error('缺少客户画像横条')
}

const stripRule = findRule(pageSource, '.profile-summary-strip')
if (!/grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(stripRule)) {
  throw new Error('画像摘要区必须单列展示，让学员画像和客户画像分成两行')
}
if (/repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(stripRule)) {
  throw new Error('画像摘要区不能把学员画像和客户画像放在同一行')
}

const barRule = findRule(pageSource, '.profile-summary-bar')
if (!/grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/.test(barRule)) {
  throw new Error('画像摘要条应保持图标、内容、操作按钮三段横向布局')
}
if (!/min-height:\s*76px/.test(barRule)) {
  throw new Error('画像摘要条需要是紧凑长条，不能退回大卡片高度')
}

console.log('销售训练画像横条布局契约检查通过')
