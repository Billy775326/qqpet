import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { loadGame } from '../src/renderer/swf/game-player.ts'

test('desktop game submovies retain their resource base and start at the same volume', async () => {
  const actions: unknown[][] = []
  let volume = 1
  const player = {
    load: async (...args: unknown[]) => { actions.push(['load', ...args]) },
    el: { ruffle: () => ({
      set volume(value: number) { volume = value; actions.push(['volume', value]) },
      resume() { assert.equal(volume, 0.3); actions.push(['resume']) },
    }) },
  } as unknown as Parameters<typeof loadGame>[0]
  await loadGame(player, 'pet/smallGame/rope/prompt_money_102.swf', 'pet/smallGame/rope/')
  assert.deepEqual(actions, [
    ['load', 'pet/smallGame/rope/prompt_money_102.swf', 'pet/smallGame/rope/', { autoplay: 'off' }],
    ['volume', 0.3], ['resume'],
  ])
})

test('games load paused, apply thirty-percent volume before playback, and retain input focus', async () => {
  for (const touch of [false, true]) {
    const events: unknown[][] = []
    let loaded!: () => void
    const ready = new Promise<void>(resolve => { loaded = resolve })
    let volume = 1
    const playback = {
      get volume() { return volume },
      set volume(value: number) { volume = value; events.push(['volume', value]) },
      resume() { assert.equal(volume, 0.3); events.push(['resume']) },
    }
    const element = { ruffle: () => playback, focus: () => events.push(['focus']) }
    class Player {
      el = element
      load(url: string, base: unknown, options: unknown) { events.push(['load', url, base, options]); return ready }
    }
    const document = { body: {}, title: '' }
    const fixture = globalThis as typeof globalThis & { __gameVolume?: unknown }
    fixture.__gameVolume = { Player, document, touch, location: { search: '?swf=' + encodeURIComponent('企鹅/QQ飞车.swf') }, gamepad: (el: unknown, swf: string) => { assert.equal(el, element); events.push(['gamepad', swf]) } }
    try {
      const bundle = await build({
        entryPoints: ['src/renderer/game.ts'], bundle: true, write: false, format: 'esm',
        banner: { js: 'const {document,location}=globalThis.__gameVolume;' },
        plugins: [{ name: 'game-volume-fixture', setup(b) {
          b.onResolve({ filter: /^\.\/(swf\/player|ui\/dom|ui\/gamepad)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === './swf/player'
            ? 'export const SwfPlayer=globalThis.__gameVolume.Player;'
            : args.path === './ui/dom' ? 'export const touch=globalThis.__gameVolume.touch;' : 'export const gamepad=globalThis.__gameVolume.gamepad;' }))
        } }],
      })
      const execution = import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64') + '#' + touch)
      await new Promise(resolve => setImmediate(resolve))
      assert.deepEqual(events, [['load', 'pet/game/企鹅/QQ飞车.swf', undefined, { letterbox: 'on', autoplay: 'off' }]])
      loaded()
      await execution
      assert.equal(document.title, 'QQ飞车')
      assert.deepEqual(events.slice(1), [['volume', 0.3], ['resume'], ['focus'], ...(touch ? [['gamepad', '企鹅/QQ飞车.swf']] : [])])
    } finally {
      loaded()
      delete fixture.__gameVolume
    }
  }
})
