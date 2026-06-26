import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const sourcePath = join(process.cwd(), 'src', 'shared', 'api', 'url.ts')
const source = readFileSync(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
})

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const { buildApiUrl, normalizeApiBaseUrl } = await import(moduleUrl)

const cases = [
  [undefined, '/chat', '/api/v2/chat'],
  ['/api', '/chat', '/api/v2/chat'],
  ['/api/', '/chat', '/api/v2/chat'],
  ['http://127.0.0.1:8000', '/chat', 'http://127.0.0.1:8000/api/v2/chat'],
  ['http://127.0.0.1:8000/api/v2', '/chat', 'http://127.0.0.1:8000/api/v2/chat'],
]

for (const [baseUrl, path, expected] of cases) {
  const actual = buildApiUrl(path, baseUrl)
  if (actual !== expected) {
    throw new Error(`API 地址拼接错误：base=${baseUrl ?? '默认'} path=${path} actual=${actual} expected=${expected}`)
  }
}

const normalized = normalizeApiBaseUrl('/api/v2/')
if (normalized !== '/api/v2') {
  throw new Error(`API 基础地址归一化错误：${normalized}`)
}

console.log('API V2 地址契约检查通过')
