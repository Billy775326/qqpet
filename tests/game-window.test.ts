import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { build } from 'esbuild'

test('independent games become visible after a hidden launch and stay eligible for the taskbar', async () => {
  for (const hiddenLaunch of [true, false]) {
    class Window extends EventEmitter {
      options: { skipTaskbar?: boolean }
      visible = !hiddenLaunch
      showCount = 0
      url = ''
      webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler() {} })
      constructor(options: { skipTaskbar?: boolean }) { super(); this.options = options }
      show() { this.visible = true; this.showCount++ }
      loadURL(url: string) { this.url = url; return Promise.resolve() }
    }
    const fixture = globalThis as typeof globalThis & { __gameWindow?: unknown }
    fixture.__gameWindow = { BrowserWindow: Window, screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1040 } }) } }
    try {
      const result = await build({
        entryPoints: ['src/main/window.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
        define: { 'process.env.ELECTRON_RENDERER_URL': 'undefined', 'import.meta.dirname': '"fixture"' },
        plugins: [{ name: 'isolated-game-window', setup(b) {
          b.onResolve({ filter: /^(electron|\.\/fullscreen|\.\/protocol)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'electron'
            ? 'export const {screen,BrowserWindow}=globalThis.__gameWindow;'
            : args.path === './fullscreen' ? 'export const hideOnFullscreen=()=>{};' : 'export const APP_ORIGIN="app://bundle";' }))
        } }],
      })
      const module = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64') + '#' + hiddenLaunch)
      const win = module.openGameWindow('企鹅/QQ飞车.swf') as Window
      assert.equal(win.options.skipTaskbar, false)
      assert.equal(win.visible, !hiddenLaunch)
      assert.equal(new URL(win.url).searchParams.get('swf'), '企鹅/QQ飞车.swf')
      win.emit('ready-to-show')
      assert.equal(win.visible, true, 'a loaded game must become visible even when the launcher initially hides it')
      win.emit('ready-to-show')
      assert.equal(win.showCount, 1, 'later activity cannot repeatedly force the game to the foreground')
    } finally {
      delete fixture.__gameWindow
    }
  }
})
