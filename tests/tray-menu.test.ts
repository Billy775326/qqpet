import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

// Exercise the real renderer cursor handler and menu actions without loading SWFs.
class Element {
  className = ''
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  children: Element[] = []
  parent: Element | null = null
  events: Record<string, Function[]> = {}
  classList = { toggle() {}, contains: () => false }
  get isConnected(): boolean { return this === body || this.parent?.isConnected === true }
  append(...children: unknown[]) {
    for (const child of children) {
      if (child instanceof Element) { child.parent = this; this.children.push(child) }
      else if (typeof child === 'string') this.textContent += child
    }
  }
  appendChild(child: Element) { this.append(child) }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null }
  contains(target: Element): boolean { return target === this || this.children.some(c => c.contains(target)) }
  closest(selector: string): Element | null { return selector === '[data-hit]' && 'hit' in this.dataset ? this : this.parent?.closest(selector) ?? null }
  addEventListener(name: string, fn: Function) { (this.events[name] ??= []).push(fn) }
  emit(name: string, event = {}) { for (const fn of this.events[name] ?? []) fn({ target: this, ...event }) }
  textContent = ''
}
const body = new Element()

test('hidden pet tray menu survives travel across desktop and tray popup, and can restore the pet', async () => {
  const callbacks: Record<string, Function> = {}
  const save = { havePet: true, settings: { hidden: true, paused: false }, petInfo: { lastX: 100, lastY: 100, health: 5, growth: 0, sex: 'GG' } }
  const stub = `
    export const save = globalThis.testSave, info = save.petInfo;
    export const stage = () => 'Kid', mood = () => 'peaceful';
    export const petSize = () => 100, onInfoChange = () => {}, setInfo = (k,v) => {info[k]=v};
    export const update = (group,patch) => Object.assign(save[group],patch);
    export const setPaused = () => {}, setTray = () => {}, aiOn = () => false;
    export const speak = (_s,_a,hooks) => {hooks?.start?.();hooks?.end?.()}, machine = {play(){}}, bury = () => {};
    export const startPet = () => {}, resumeTask = () => {}, clipAsk = () => {};
    export const frame = (content) => content;
    export const adopt = () => {}, openChat = () => {}, openGoods = () => {}, openPetInfo = () => {}, openSetup = () => {}, openShop = () => {};
    export const openState = () => {}, scheduleHide = () => {}, showControl = () => {}, collapseControls = () => {};
    export const createEdgeMini = () => ({refresh(){},trackPointer(){},enter(){}});
    export const createEdgeIdle = () => ({trackPointer(){},interrupt(){}});
  `
  const bundled = await build({
    entryPoints: ['src/renderer/main.ts'], bundle: true, write: false, format: 'iife',
    plugins: [{ name: 'mock-pet-runtime', setup(b) {
      b.onResolve({ filter: /^(\.\/pet\/|\.\.\/pet\/|\.\/ui\/|\.\/)/ }, args => {
        // Keep the actual menu and DOM helpers; stub unrelated UI and pet runtime.
        if (!args.importer) return
        if (['./ui/menu', './ui/dom', './dom', './pet/geometry', '../../shared/pet-geometry'].includes(args.path)) return
        return { path: args.path, namespace: 'stub' }
      })
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
    } }],
  })
  body.children = []
  const pet = new Element(); body.append(pet)
  const desktop = new Element(); body.append(desktop)
  let target: Element | null = null
  let clickThrough = true
  let themed = false
  const document = { body, documentElement: { classList: { toggle: (_name: string, on: boolean) => { themed = on } } }, createElement: () => new Element(), getElementById: () => pet, elementFromPoint: () => target, addEventListener(name: string, fn: Function) { callbacks[name] = fn } }
  runInNewContext(bundled.outputFiles[0].text, {
    document, testSave: save, innerWidth: 1200, innerHeight: 800,
    matchMedia: () => ({ matches: false }), Event,
    requestAnimationFrame: (fn: Function) => fn(0),
    window: { addEventListener() {}, dispatchEvent() {}, qqpet: { onCursor: (fn: Function) => { callbacks.cursor = fn }, onTrayClick: (fn: Function) => { callbacks.tray = fn }, onClipboard() {}, setClickThrough: (on: boolean) => { clickThrough = on } } },
  })
  const menu = () => body.children.find(c => c.className === 'ui-menu')
  const move = (over: Element | null, x = 600, y = 400) => { target = over; callbacks.cursor({ x, y }) }
  const open = () => callbacks.tray({ kind: 'menu', x: 1100, y: 700 })
  open()
  move(null, 1100, 850) // taskbar, outside work area
  move(desktop) // empty route from overflow to menu
  assert.ok(menu(), 'menu disappeared before the pointer could reach it')
  assert.equal(clickThrough, true, 'desktop must remain clickable during travel')
  const popup = menu()!, surface = popup.children[0]
  move(surface) // hit-test can see the menu behind the shell overflow popup
  move(desktop)
  assert.equal(menu(), popup, 'occluded coordinate hit must not arm dismissal')
  surface.emit('pointerenter') // actual entry once the pointer reaches the app
  const rows = surface.children[0].children
  const show = rows.find(row => row.children.some(c => c.children.length === 0 && c.textContent === '显示宠物'))
  assert.ok(show, 'hidden pet must have a show action')
  move(show)
  assert.equal(clickThrough, false)
  assert.equal(themed, true, 'first hover must enable the original cursor before clicking')
  show.emit('click')
  assert.equal(save.settings.hidden, false)
  assert.equal(menu(), undefined)
  move(desktop)
  assert.equal(clickThrough, true)
  assert.equal(themed, false, 'leaving the hit region must restore the desktop cursor')
  open()
  const next = menu()!, nextSurface = next.children[0]
  nextSurface.emit('pointerenter')
  const submenu = nextSurface.children[0].children[1].children.at(-1)!.children[0]
  move(submenu)
  assert.equal(menu(), next, 'submenu must remain interactive')
  move(desktop)
  assert.equal(menu(), undefined, 'leaving an entered menu must dismiss it')
  open(); move(desktop)
  assert.ok(menu(), 'reopened menu must reset its entry state')
  callbacks.keydown({ key: 'Escape' })
  assert.equal(menu(), undefined)
  open(); callbacks.pointerdown({ target: desktop })
  assert.equal(menu(), undefined, 'explicit outside app click must dismiss it')
})
