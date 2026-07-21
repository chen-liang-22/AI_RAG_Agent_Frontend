import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const homeSource = readFileSync(join(root, 'src/features/dashboard/pages/HomePage.vue'), 'utf8')
const dictionarySource = readFileSync(join(root, 'src/features/system/pages/DictionaryManagementPage.vue'), 'utf8')

/** 提取页面根节点的首个 CSS 规则，确保页面在固定高度父容器内自行滚动。 */
function extractRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'))
  if (!match) throw new Error(`缺少页面滚动规则：${selector}`)
  return match[1]
}

/** 校验页面根节点具备稳定高度约束和纵向滚动能力。 */
function assertScrollablePage(source, selector) {
  const rule = extractRule(source, selector)
  for (const declaration of ['height: 100%', 'min-height: 0', 'overflow-y: auto']) {
    if (!rule.includes(declaration)) {
      throw new Error(`${selector} 缺少页面级滚动声明：${declaration}`)
    }
  }
}

assertScrollablePage(homeSource, '.neutral-home-page')
assertScrollablePage(dictionarySource, '.dictionary-management-page')

if (/\.dictionary-management-page\s*\{[^}]*height:\s*auto\s*;/s.test(dictionarySource)) {
  throw new Error('字典管理页在窄屏规则中覆盖为 height:auto，内容仍会被父容器裁剪')
}

console.log('首页与字典管理页纵向滚动契约检查通过')
