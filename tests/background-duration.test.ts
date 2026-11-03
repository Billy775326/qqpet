import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'

async function fixture(background: { id: string; left: number } | null = null) {
  const state = { save: { selfGoodUseOption: { background, food: null, clean: null, toy: null } } }
  const result = await build({
    stdin: { contents: `export {goodOf,allGoods,describe,durationText} from './src/renderer/pet/data/goods';export {startTimed,tickTimed} from './src/renderer/pet/goods';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'cjs',
    plugins: [{ name: 'isolated-timed-goods', setup(b) {
      b.onResolve({ filter: /^\.\/store$/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const save=globalThis.state.save;export const update=(group,patch)=>Object.assign(save[group],patch);' }))
    } }],
  })
  const module = { exports: {} as any }
  runInNewContext(result.outputFiles[0].text, { state, module, exports: module.exports })
  return { state, api: module.exports }
}

test('background catalogue numbers become real days and countdowns persist in minutes', async () => {
  const { api, state } = await fixture()
  const catalogue = JSON.parse(readFileSync('src/renderer/pet/data/goods.json', 'utf8'))
  for (const raw of Object.values(catalogue.background) as { id: string; useTimeing: number }[]) {
    if (raw.id === 'b0000000') continue
    const good = api.goodOf('background', raw.id)
    assert.equal(good.useTimeing, raw.useTimeing * 1440)
    assert.ok(api.describe(good).includes(`持续时间：${raw.useTimeing}天`))
  }
  api.startTimed(api.goodOf('background', 'b0000001'))
  assert.equal(state.save.selfGoodUseOption.background?.left, 86400, '60 days must be 86400 minutes, not 60 minutes')
  api.tickTimed(60)
  assert.equal(state.save.selfGoodUseOption.background?.left, 86340)
  assert.equal(api.durationText(api.goodOf('background', 'b0000001'), 86340), '60天')
  api.tickTimed(86340)
  assert.equal(state.save.selfGoodUseOption.background, null)
})

test('no-background omits duration and other timed goods keep minute units', async () => {
  const { api } = await fixture()
  const empty = api.goodOf('background', 'b0000000')
  assert.equal(api.durationText(empty), '')
  assert.equal(api.durationText(empty, 1440), '')
  assert.equal(api.describe(empty).some((line: string) => line.startsWith('持续时间')), false)
  for (const [type, id, minutes] of [['toy', 't0005', 60], ['food', '102010074', 180], ['clean', '102020052', 240]] as const) {
    const good = api.goodOf(type, id)
    assert.equal(good.useTimeing, minutes)
    assert.ok(api.describe(good).includes(`持续时间：${minutes}分钟`))
  }
  const good = api.goodOf('background', 'b0000001')
  assert.equal(api.durationText(good, 1440), '1天')
  assert.equal(api.durationText(good, 1441), '2天')
  assert.equal(api.durationText(good, 1), '1天')
  assert.equal(api.durationText(good, 0), '')
})

test('existing active backgrounds retain their saved remaining minutes', async () => {
  const { api, state } = await fixture({ id: 'b0000001', left: 15 })
  assert.equal(state.save.selfGoodUseOption.background?.left, 15)
  api.tickTimed(5)
  assert.equal(state.save.selfGoodUseOption.background?.left, 10)
})
