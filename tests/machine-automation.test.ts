import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function rendering() {
  const state = { now: 0, hold: false, tick: () => {}, release: () => {} }
  const built = await build({
    entryPoints: ['src/renderer/pet/machine.ts'], bundle: true, write: false, format: 'cjs',
    plugins: [{ name: 'isolated-machine', setup(b) {
      b.onResolve({ filter: /store$/ }, () => ({ path: 'store', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: "export const info={health:5,sex:'GG'},mood=()=> 'peaceful',stage=()=> 'Kid';",
      }))
    } }],
  })
  const module = { exports: {} as any }
  runInNewContext(built.outputFiles[0].text, {
    module, exports: module.exports, performance: { now: () => state.now },
    setInterval: (fn: () => void) => { state.tick = fn; return 1 },
  })
  const front = { totalFrames: 2, currentFrame: 1, isPlaying: false }
  const swf = { front, load: () => state.hold ? new Promise<void>(resolve => { state.release = resolve }) : Promise.resolve() }
  const machine = new module.exports.Machine(swf, () => {})
  const settle = async () => { await Promise.resolve(); await Promise.resolve() }
  machine.start()
  machine.play({ a: 'normal' })
  state.tick()
  await settle()
  assert.equal(machine.idle, true)
  return { state, machine, front, settle }
}

test('automatic actions can proceed after a visual load stalls without changing the animation', async () => {
  const { state, machine, settle } = await rendering()
  state.hold = true
  machine.play({ a: 'speak' })
  state.tick()
  assert.equal(machine.automationReady, false)
  state.now = 9999
  assert.equal(machine.automationReady, false, 'normal image loading retains its grace period')
  state.now = 10000
  assert.equal(machine.automationReady, true, 'a paused paint callback cannot block automation indefinitely')
  assert.equal(machine.pose.a, 'normal', 'readiness does not force or duplicate visual transitions')
  state.hold = false
  state.release()
  await settle()
  assert.equal(machine.pose.a, 'speak')
  assert.equal(machine.automationReady, false)
  state.tick()
  await settle()
  assert.equal(machine.idle, true)
})

test('a normally playing animation is not treated as a stalled load', async () => {
  const { state, machine, front, settle } = await rendering()
  front.currentFrame = 0
  machine.play({ a: 'play' })
  state.tick()
  await settle()
  state.now = 60000
  assert.equal(machine.automationReady, false)
  assert.equal(machine.pose.a, 'play')
})
