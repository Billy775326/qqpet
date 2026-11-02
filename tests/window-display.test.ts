import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import { build } from 'esbuild'

test('pet overlay follows taskbar work-area changes and releases display listeners on close', async () => {
  let area = { x: 0, y: 0, width: 1920, height: 1040 }
  const screen = Object.assign(new EventEmitter(), {
    getPrimaryDisplay: () => ({ workArea: { ...area } }),
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  })
  class Window extends EventEmitter {
    bounds: typeof area
    destroyed = false
    webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler() {}, send() {}, openDevTools() {},
    })
    constructor(options: typeof area) {
      super()
      this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }
    }
    getBounds() { return { ...this.bounds } }
    setBounds(next: typeof area) { this.bounds = { ...next } }
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    setIgnoreMouseEvents() {}
    isDestroyed() { return this.destroyed }
    loadURL() { return Promise.resolve() }
    close() { this.destroyed = true; this.emit('closed') }
  }
  const fixture = globalThis as typeof globalThis & { __windowDisplay?: unknown }
  fixture.__windowDisplay = { screen, BrowserWindow: Window }
  let win: Window | undefined
  try {
    const result = await build({
      entryPoints: ['src/main/window.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
      define: { 'import.meta.dirname': JSON.stringify(resolve('src/main')) },
      plugins: [{ name: 'isolated-display-runtime', setup(b) {
        b.onResolve({ filter: /^(electron|\.\/fullscreen|\.\/protocol)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: args.path === 'electron'
            ? 'export const {screen,BrowserWindow}=globalThis.__windowDisplay;'
            : args.path === './fullscreen'
              ? 'export const hideOnFullscreen=()=>{};'
              : 'export const APP_ORIGIN="app://bundle";',
        }))
      } }],
    })
    const module = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
    win = module.createPetWindow()
    assert.deepEqual(win!.getBounds(), area)

    // A hidden bottom taskbar releases its reserved work-area strip.
    area = { x: 0, y: 0, width: 1920, height: 1080 }
    screen.emit('display-metrics-changed', {}, {}, ['workArea'])
    assert.deepEqual(win!.getBounds(), area)

    // Showing it again restores the reservation.
    area = { x: 0, y: 0, width: 1920, height: 1040 }
    screen.emit('display-metrics-changed', {}, {}, ['workArea'])
    assert.deepEqual(win!.getBounds(), area)

    // Primary-display changes can also move the origin or reserve a side.
    area = { x: 48, y: 0, width: 1232, height: 720 }
    screen.emit('display-added', {}, {})
    assert.deepEqual(win!.getBounds(), area)
    area = { x: 0, y: 40, width: 1280, height: 680 }
    screen.emit('display-removed', {}, {})
    assert.deepEqual(win!.getBounds(), area)

    const closedBounds = win!.getBounds()
    win!.close()
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) {
      assert.equal(screen.listenerCount(event), 0)
      area = { x: 0, y: 0, width: 2560, height: 1440 }
      screen.emit(event, {}, {})
    }
    assert.deepEqual(win!.getBounds(), closedBounds)
  } finally {
    if (win && !win.destroyed) win.close()
    delete fixture.__windowDisplay
  }
})
