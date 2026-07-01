import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const styleSource = readFileSync(join(root, 'src/style.css'), 'utf8')

function assertRuleIncludes(source, selector, expected) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedExpected = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{[^}]*${escapedExpected}[^}]*\\}`)
  if (!rulePattern.test(source)) {
    throw new Error(`弹窗样式未生效：${selector} 缺少 ${expected}`)
  }
}

assertRuleIncludes(styleSource, '.el-message-box', 'width: min(420px, calc(100vw - 32px))')
assertRuleIncludes(styleSource, '.el-message-box', 'border-radius: 10px')
assertRuleIncludes(styleSource, '.el-message-box', 'background:')
assertRuleIncludes(styleSource, '.el-message-box__header', 'padding: 12px 14px 8px')
assertRuleIncludes(styleSource, '.el-message-box__content', 'padding: 8px 14px 10px')
assertRuleIncludes(styleSource, '.el-message-box__btns', 'padding: 8px 14px 14px')
assertRuleIncludes(styleSource, '.el-dialog', 'border-radius: 10px')
assertRuleIncludes(styleSource, '.el-dialog__header', 'padding: 12px 14px 10px')

console.log('弹窗科技风紧凑样式契约检查通过')
