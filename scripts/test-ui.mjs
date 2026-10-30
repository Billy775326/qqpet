import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createPackage } from '@electron/asar'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = join(root, 'tests/ui')
mkdirSync(join(root, 'dist'), { recursive: true })
const { prepareControls } = await import('../tests/ui/prepare-controls.mjs')
await prepareControls()
const { prepareMini } = await import('../tests/ui/prepare-mini.mjs')
await prepareMini()
const { prepareCursor } = await import('../tests/ui/prepare-cursor.mjs')
await prepareCursor()
const { prepareShop } = await import('../tests/ui/prepare-shop.mjs')
await prepareShop()
const suites = JSON.parse(readFileSync(join(fixture, 'suites.json'), 'utf8'))
let executable, packaged = false
if (process.env.QQPET_TEST_ELECTRON_RUNTIME) {
  executable = resolve(process.env.QQPET_TEST_ELECTRON_RUNTIME)
  const within = relative(join(root, 'dist'), executable)
  if (!within || within.startsWith('..') || isAbsolute(within)) throw Error('The test runtime must be inside this repository\'s ignored dist directory')
  // Only an explicitly selected disposable test runtime may have its test archive replaced.
  await createPackage(fixture, join(dirname(executable), 'resources/app.asar'))
  packaged = true
} else {
  const pathFile = join(root, 'node_modules/electron/path.txt')
  if (!existsSync(pathFile)) throw Error('Install Electron with npm ci, or set QQPET_TEST_ELECTRON_RUNTIME to a disposable Electron runtime under dist/')
  executable = join(root, 'node_modules/electron/dist', readFileSync(pathFile, 'utf8').trim())
}
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const selected = process.argv.slice(2)
if (selected.some(suite => !suites.includes(suite))) throw Error('Unknown UI test suite')
for (const suite of suites.filter(suite => !selected.length || selected.includes(suite))) {
  await new Promise((done, fail) => {
    const child = spawn(executable, [...(packaged ? [] : [fixture]), `--suite=${suite}`], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    const timeout = setTimeout(() => { child.kill(); fail(Error(`UI suite timed out: ${suite}`)) }, 90000)
    child.once('error', error => { clearTimeout(timeout); fail(error) })
    child.once('exit', code => { clearTimeout(timeout); code === 0 ? done() : fail(Error(`UI suite failed: ${suite} (${code})`)) })
  })
}
