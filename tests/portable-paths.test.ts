import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { mkdtempSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

test('portable bootstrap contains every configured storage path beside the executable', async () => {
  const root = mkdtempSync(resolve('dist/portable-path-test-'))
  const result = await build({ entryPoints: ['src/main/paths.ts'], bundle: true, write: false, platform: 'node', format: 'esm', define: { 'process.platform': '"win32"', 'process.execPath': JSON.stringify(join(root, 'QQPet.exe')) }, plugins: [{ name: 'mock-electron', setup(b) {
    b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `const paths = {}; export const app = {isPackaged:true,setPath(k,v){paths[k]=v},getPath(k){return paths[k]},setAppLogsPath(v){paths.logs=v},exit(){throw new Error('unexpected exit')}}; export const dialog={showErrorBox(){}}; globalThis.__portablePaths=paths;` }))
  } }] })
  const old = [process.env.TEMP, process.env.TMP, process.env.TMPDIR]
  try {
    await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
    const paths = (globalThis as any).__portablePaths
    assert.deepEqual(Object.keys(paths).sort(), ['crashDumps', 'logs', 'sessionData', 'temp', 'userData'])
    for (const path of Object.values(paths) as string[]) assert.ok(path.startsWith(join(root, 'data')))
    assert.ok(existsSync(paths.userData))
    assert.equal(process.env.TEMP, paths.temp)
  } finally {
    for (const [i,k] of ['TEMP','TMP','TMPDIR'].entries()) { if(old[i]===undefined) delete process.env[k];else process.env[k]=old[i] }
    delete (globalThis as any).__portablePaths
  }
})
