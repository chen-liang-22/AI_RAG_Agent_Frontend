import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const indexSource = readFileSync(join(root, 'index.html'), 'utf8')
const loginSource = readFileSync(join(root, 'src/app/LoginGate.vue'), 'utf8')
const shellSource = readFileSync(join(root, 'src/app/AppShell.vue'), 'utf8')
const homeSource = readFileSync(join(root, 'src/features/dashboard/pages/HomePage.vue'), 'utf8')
const chatSource = readFileSync(join(root, 'src/features/chat/pages/ChatPage.vue'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.vue'), 'utf8')
const recentVisitsSource = readFileSync(join(root, 'src/app/recentVisits.ts'), 'utf8')
const httpSource = readFileSync(join(root, 'src/shared/api/http.ts'), 'utf8')
const packageSource = readFileSync(join(root, 'package.json'), 'utf8')

const requiredBrandFragments = [
  [indexSource, '<title>知域 Nexus</title>', '浏览器标题'],
  [loginSource, '<strong>知域 Nexus</strong>', '登录页品牌'],
  [shellSource, '<h1>知域</h1>', '应用侧栏品牌'],
  [homeSource, '知域 Nexus', '首页品牌'],
  [chatSource, '<h1>知域</h1>', '问答侧栏品牌'],
  [chatSource, '知域 Nexus · 智能检索中枢', '问答页品牌'],
]

for (const [source, fragment, surface] of requiredBrandFragments) {
  if (!source.includes(fragment)) {
    throw new Error(`${surface}缺少正式产品名：${fragment}`)
  }
}

const uiSources = [indexSource, loginSource, shellSource, homeSource, chatSource]
for (const legacyName of ['知习台', 'AI RAG Agent', 'Direct RAG']) {
  if (uiSources.some((source) => source.includes(legacyName))) {
    throw new Error(`用户界面仍包含旧产品名：${legacyName}`)
  }
}

const requiredTechnicalIdentifiers = [
  [appSource, 'ai-rag-agent-theme'],
  [recentVisitsSource, 'ai-rag-agent-recent-visits'],
  [httpSource, 'ai-rag-agent-auth-expired'],
  [packageSource, 'ai-rag-agent-frontend'],
]
for (const [source, identifier] of requiredTechnicalIdentifiers) {
  if (!source.includes(identifier)) {
    throw new Error(`品牌替换误改技术标识：${identifier}`)
  }
}

console.log('知域 Nexus 用户界面品牌契约检查通过')
