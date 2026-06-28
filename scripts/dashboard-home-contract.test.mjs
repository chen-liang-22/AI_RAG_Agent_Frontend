import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const homeSource = readFileSync(join(root, 'src/features/dashboard/pages/HomePage.vue'), 'utf8')
const appShellSource = readFileSync(join(root, 'src/app/AppShell.vue'), 'utf8')
const navTreeSource = readFileSync(join(root, 'src/app/PortalNavTree.vue'), 'utf8')
const styleSource = readFileSync(join(root, 'src/style.css'), 'utf8')

const forbiddenHomeFragments = [
  '知识库概览',
  '知识矩阵',
  '多库航道',
  '字典引擎',
  '会话星轨',
  '服务健康',
  'cockpitCards',
  'cockpit-grid',
  'overviewKnowledgeFiles',
  'overviewPagedKnowledgeFiles',
  'overviewCollectionTabs',
  'overview-collection-tabs',
  'dashboard-knowledge-table',
]

const forbiddenStyleFragments = [
  'cockpit-grid',
  'cockpit-card',
  'cockpit-icon',
]

for (const fragment of forbiddenHomeFragments) {
  if (homeSource.includes(fragment)) {
    throw new Error(`首页仍包含知识库概览片段：${fragment}`)
  }
}

for (const fragment of forbiddenStyleFragments) {
  if (styleSource.includes(fragment)) {
    throw new Error(`全局样式仍残留已删除首页模块片段：${fragment}`)
  }
}

if (!homeSource.includes('最近会话')) {
  throw new Error('首页最近会话模块被误删')
}

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}

function assertRuleIncludes(source, selector, expected) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{[^}]*${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^}]*\\}`)
  if (!rulePattern.test(source)) {
    throw new Error(`样式规则未生效：${selector} 缺少 ${expected}`)
  }
}

assertIncludes(appShellSource, 'fetchHealth', '顶栏未接入服务健康检查接口')
assertIncludes(appShellSource, 'portal-health-button', '服务健康状态未放到右上角工具区')
assertIncludes(appShellSource, 'aria-label="服务健康状态"', '服务健康状态按钮缺少无障碍标签')
assertIncludes(appShellSource, ':title="healthTitle"', '服务健康状态按钮缺少悬浮提示')

assertRuleIncludes(styleSource, '.portal-topbar', 'min-height: 34px')
assertRuleIncludes(styleSource, '.portal-icon-button', 'width: 34px')
assertRuleIncludes(styleSource, '.portal-brand-mark', 'width: 36px')
assertRuleIncludes(styleSource, '.portal-nav-item', 'min-height: 62px')
assertRuleIncludes(styleSource, '.portal-nav-item span', 'width: 32px')
assertRuleIncludes(styleSource, '.portal-health-button.tone-good', 'box-shadow: 0 0 24px')
assertRuleIncludes(styleSource, '.page-hero', 'padding: 10px 14px')
assertRuleIncludes(homeSource, '.sales-cockpit', 'padding: 16px 18px')
assertRuleIncludes(homeSource, '.sales-stat-card > span', 'width: 32px')

assertIncludes(homeSource, 'sales-stat-card', '首页销售训练概览卡片被误删')
assertIncludes(homeSource, ':size="16"', '首页紧凑图标尺寸未生效')
assertIncludes(homeSource, ':size="14"', '首页页眉小图标尺寸未生效')
assertIncludes(appShellSource, '<Sparkles :size="18" />', '侧栏品牌图标尺寸未缩小')
assertIncludes(navTreeSource, '<component :is="item.icon" :size="16" />', '侧栏导航图标尺寸未缩小')
assertIncludes(appShellSource, '<LogOut v-else :size="16" />', '顶栏退出图标尺寸未缩小')
assertIncludes(appShellSource, '<component :is="themeToggleIcon" :size="16" />', '顶栏主题图标尺寸未缩小')

console.log('首页与顶栏状态入口契约检查通过')
