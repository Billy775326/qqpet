import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { startSave } from '../src/shared/save-logic.ts'

async function farm() {
  const save = startSave(null)
  Object.assign(save.petInfo, { sweetHeart: true, sweetHeartOverTime: Date.now() / 1000 + 86400, health: 5 })
  save.settings.careAutoFarm = true
  const now = Math.floor(Date.now() / 1000)
  const original = {
    experience: '98', rank: '01', wealth: String(save.petInfo.yb), checked: now,
    farmland: [
      { farmland: 'FarmlandG', crop: 'RadishSeed', time: now - 5, grass: 1, worm: 1 },
      { farmland: 'FarmlandG', crop: 'RadishSeed', time: now - 100000, grass: 1, worm: 1, state: 5 },
    ], warehouse: [{ fruit: 'RadishSeed', number: 10 }], burden: [{ Items: 'Fertilizer', number: 4 }],
  }
  save.saveJsonData.farm = JSON.stringify(original)
  const storage = new Map<string, string>([['farm:migrated', '1']])
  const state = { save, hover: false, ready: true, calls: [] as string[], live: original as any, close: () => {}, timers: new Set<Function>(), revision: 0, warnings: 0 }
  const stub = `
    const state=globalThis.state;
    export const save=state.save,info=save.petInfo,avatar=()=>'',refreshMilestones=()=>{};
    export const setInfo=(k,v)=>info[k]=v,update=(k,p)=>Object.assign(save[k],p);
    export const readSol=()=>({user:JSON.parse(JSON.stringify(state.live))});
    export const writeSol=(_k,_n,data)=>{state.live=data.user;localStorage.setItem('bundle//test',String(++state.revision))};
    export const div=()=>({}),img=()=>({}),button=()=>({});
    export const openBox=(_content,options)=>{state.close=options.onClose};
    export class SwfPlayer {
      el={};constructor(){if(state.ready)this.el.farmAll=action=>{state.calls.push(action);state.live.farmland[0].farmland='FarmlandS';delete state.live.farmland[0].grass;delete state.live.farmland[0].worm;state.live.experience=4;state.live.rank=2;localStorage.setItem('bundle//test',String(++state.revision));return 'done'}}
      load(){return Promise.resolve()}
    }
  `
  const bundled = await build({
    entryPoints: ['src/renderer/ui/farm.ts'], bundle: true, write: false, format: 'cjs',
    plugins: [{ name: 'isolated-farm-care', setup(b) {
      b.onResolve({ filter: /.*/ }, args => !args.importer || args.path === '../../shared/farm-care' ? undefined : { path: args.path, namespace: 'fixture' })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: stub }))
    } }],
  })
  const module = { exports: {} as { farmNews: () => Promise<{ ripe: number; pests: number } | null>; openFarm: () => void } }
  const document = { documentElement: { classList: { contains: () => state.hover } } }
  class Parser { parseFromString() { return { querySelectorAll: () => [{ getAttribute: (k: string) => k === 'seed' ? 'RadishSeed' : '50400' }] } } }
  runInNewContext(bundled.outputFiles[0].text, {
    module, exports: module.exports, state, document, Date, location: { hostname: 'bundle' },
    window: { qqpet: { setFocusable() {} } },
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
    setInterval: (fn: Function) => { state.timers.add(fn); return fn }, clearInterval: (fn: Function) => state.timers.delete(fn),
    fetch: async () => ({ text: async () => '<data/>' }), DOMParser: Parser,
    console: { warn() { state.warnings++ } },
  })
  return { save, state, api: module.exports, original, poll: () => { for (const fn of state.timers) fn() } }
}

test('closed-farm care clears growing plots without changing mature yield, wealth or stock', async () => {
  const { save, api, original } = await farm()
  const news = await api.farmNews()
  assert.equal(news?.ripe, 1)
  assert.equal(news?.pests, 0)
  const after = JSON.parse(save.saveJsonData.farm)
  assert.equal(after.experience, 4)
  assert.equal(after.rank, 2)
  assert.equal(after.farmland[0].farmland, 'FarmlandS')
  assert.equal(after.farmland[0].crop, original.farmland[0].crop)
  assert.deepEqual(after.farmland[1], original.farmland[1], 'overnight ripe crops keep their pest penalties until normal settlement')
  assert.deepEqual(after.warehouse, original.warehouse)
  assert.deepEqual(after.burden, original.burden)
  assert.equal(after.wealth, original.wealth)
  await api.farmNews()
  assert.equal(JSON.parse(save.saveJsonData.farm).experience, 4)
})

test('disabled, expired, paused, dead and interacting pets leave farm needs pending', async () => {
  for (const blocked of ['disabled', 'expired', 'paused', 'dead', 'hover']) {
    const { save, state, api } = await farm()
    if (blocked === 'disabled') save.settings.careAutoFarm = false
    if (blocked === 'expired') save.petInfo.sweetHeartOverTime = 0
    if (blocked === 'paused') save.settings.paused = true
    if (blocked === 'dead') save.petInfo.health = 0
    if (blocked === 'hover') state.hover = true
    const news = await api.farmNews()
    assert.equal(news?.pests, 1)
    assert.equal(JSON.parse(save.saveJsonData.farm).experience, '98')
  }
})

test('open farms use the native care callback, settle once and remove polling on close', async () => {
  const { save, state, api, poll } = await farm()
  api.openFarm()
  assert.equal(state.timers.size, 1)
  assert.equal(await api.farmNews(), null, 'the closed-farm path must never overwrite an open movie')
  state.hover = true
  poll()
  assert.equal(state.calls.length, 0)
  state.hover = false
  poll()
  assert.deepEqual(state.calls, ['care'])
  assert.equal(JSON.parse(save.saveJsonData.farm).experience, 4)
  poll()
  assert.deepEqual(state.calls, ['care'])
  state.close()
  assert.equal(state.timers.size, 0)
  poll()
  assert.equal(state.warnings, 0)
})

test('closing a loading farm never waits for an unavailable SWF callback', async () => {
  const { state, api, poll } = await farm()
  state.ready = false
  api.openFarm()
  poll()
  assert.equal(state.calls.length, 0)
  state.close()
  assert.equal(state.timers.size, 0)
})
