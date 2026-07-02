import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const loginGateSource = readFileSync(join(root, 'src/app/LoginGate.vue'), 'utf8')

if (!/const loginForm = reactive\(\{\s*username:\s*''\s*,\s*password:\s*''\s*,?\s*\}\)/s.test(appSource)) {
  throw new Error('登录表单初始账号和密码必须为空，不能预填默认凭据')
}

const forbiddenLoginPageText = [
  '默认账号',
  'admin / 1234qwer',
  '1234qwer',
]

for (const text of forbiddenLoginPageText) {
  if (loginGateSource.includes(text)) {
    throw new Error(`登录页不能明文展示默认凭据：${text}`)
  }
}

console.log('登录页默认凭据隐藏契约检查通过')
