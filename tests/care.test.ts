import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

async function caring() {
  const save = startSave(null)
  save.havePet = true
  Object.assign(save.petInfo, { sweetHeart: true, sweetHeartOverTime: Date.now() / 1000 + 86400, hunger: 599, clean: 1000, mood: 1000, yb: 100 })
  Object.assign(save.petComputedlInfo, { hungerMax: 1000, cleanMax: 1000 })
  save.selfGoodDatas.food = []
  const state = { save, alerts: 0, uses: 0, defer: false, pending: [] as (() => void)[] }
  const stub = `
    const state=globalThis.state;
    export const save=state.save,info=save.petInfo,activity=()=>null;
    export const update=(group,patch)=>{if(Array.isArray(patch))save[group]=patch;else Object.assign(save[group],patch)},setInfo=(key,value)=>info[key]=value,addInfo=(key,value)=>info[key]+=value;
    export const commit=patch=>Object.entries(patch).forEach(([key,value])=>update(key,value));
    export const speak=(_line,_action,hooks={})=>{if(hooks.start){if(state.defer)state.pending.push(hooks.start);else hooks.start()}};
    export const windowView=()=>state.alerts++,floatMood=()=>{},addCount=()=>{state.uses++};
    export const DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}});
  `
  const built = await build({ stdin: { contents: "export {selfCare} from './care';export {useItem} from './items';export {goodOf} from './data/goods';", resolveDir: resolve('src/renderer/pet'), loader: 'ts' }, bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-care', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || ['./care', './data/goods', './goods', './inventory', './items'].includes(args.path) || args.path.endsWith('.json')) return
      return { path: args.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
  } }] })
  const module = { exports: {} as { selfCare: () => boolean; useItem: (g: unknown) => void; goodOf: (type: string, id: string) => unknown } }
  runInNewContext(built.outputFiles[0].text, { state, module, exports: module.exports, Date })
  return { state, save, run: module.exports.selfCare, api: module.exports }
}

test('old saves keep the existing feeding threshold and never enable automatic purchases', () => {
  const old = startSave(null)
  old.havePet = true
  const raw = JSON.parse(JSON.stringify(old))
  delete raw.settings.careHungerPercent
  delete raw.settings.careFoodId
  delete raw.settings.careAutoBuy
  for (const key of ['careCleanPercent', 'careCleanId', 'careMoodPercent', 'careToyId']) delete raw.settings[key]
  const restored = startSave(raw)
  assert.equal(restored.settings.careHungerPercent, 60)
  assert.equal(restored.settings.careFoodId, '')
  assert.equal(restored.settings.careAutoBuy, false)
  assert.equal(restored.settings.careCleanPercent, 60)
  assert.equal(restored.settings.careMoodPercent, 60)
  assert.equal(restored.settings.careCleanId, '')
  assert.equal(restored.settings.careToyId, '')
  assert.deepEqual(restored.selfGoodDatas, old.selfGoodDatas)
  applyPatch(restored, { settings: { careHungerPercent: 75, careFoodId: '102010001', careAutoBuy: true, careCleanPercent: 65, careCleanId: '102020003', careMoodPercent: 70, careToyId: 't0002' } })
  const imported = validatedImport(JSON.parse(JSON.stringify(restored)))
  assert.equal(imported.settings.careHungerPercent, 75)
  assert.equal(imported.settings.careFoodId, '102010001')
  assert.equal(imported.settings.careAutoBuy, true)
  assert.equal(imported.settings.careCleanPercent, 65)
  assert.equal(imported.settings.careCleanId, '102020003')
  assert.equal(imported.settings.careMoodPercent, 70)
  assert.equal(imported.settings.careToyId, 't0002')
  applyPatch(imported, { settings: { careHungerPercent: -1, careFoodId: '../bad', careAutoBuy: 'yes' as unknown as boolean } })
  assert.equal(imported.settings.careHungerPercent, 60)
  assert.equal(imported.settings.careFoodId, '')
  assert.equal(imported.settings.careAutoBuy, false)
})

test('hunger thresholds use the level cap and preserve one-item-per-tick feeding', async () => {
  const { save, run, state } = await caring()
  save.selfGoodDatas.food = ['_102010001*3']
  save.petInfo.hunger = 600
  run()
  assert.equal(state.uses, 0)
  save.petInfo.hunger = 599
  run()
  assert.equal(save.petInfo.hunger, 699)
  assert.deepEqual(Array.from(save.selfGoodDatas.food), ['_102010001*2'])
  run()
  assert.equal(state.uses, 1)
  save.settings.careHungerPercent = 80
  run()
  assert.equal(save.petInfo.hunger, 799)
  assert.equal(save.petInfo.yb, 100)
})

test('an explicit food never consumes another food or buys while disabled', async () => {
  const { save, run, state } = await caring()
  save.settings.careFoodId = '102010001'
  save.selfGoodDatas.food = ['_10013006*2']
  run()
  assert.deepEqual(save.selfGoodDatas.food, ['_10013006*2'])
  assert.equal(state.uses, 0)
  assert.equal(save.petInfo.yb, 100)
  save.petInfo.clean = 500
  save.selfGoodDatas.clean = ['_10021008*1']
  run()
  assert.equal(save.petInfo.clean > 500, true, 'missing food must not block available cleaning supplies')
})

test('automatic purchasing applies once without waiting for animation and honors the discount', async () => {
  const { save, run, state } = await caring()
  save.settings.careFoodId = '102010001'
  save.settings.careAutoBuy = true
  save.petInfo.pinkDiamond = true
  state.defer = true
  run()
  assert.equal(save.petInfo.yb, 96)
  assert.deepEqual(Array.from(save.selfGoodDatas.food), [])
  assert.equal(save.petInfo.hunger, 699, 'the purchased supply applies while animations are paused')
  run()
  assert.equal(save.petInfo.yb, 96)
  for (const start of state.pending) start()
  assert.equal(save.petInfo.hunger, 699)
  assert.equal(state.uses, 1, 'resuming rendering cannot apply the supply twice')
})

test('purchases obey funds, shop availability and level limits without unattended shortage alerts', async () => {
  for (const [food, funds] of [['102010001', 4], ['10013006', 10000], ['102010002', 10000], ['unknown', 10000]] as const) {
    const { save, run, state } = await caring()
    Object.assign(save.settings, { careFoodId: food, careAutoBuy: true })
    save.petInfo.yb = funds
    run()
    assert.equal(save.petInfo.yb, funds)
    assert.equal(state.uses, 0)
    assert.equal(state.alerts, 0)
  }
  const { save, run } = await caring()
  save.settings.careAutoBuy = true
  run()
  assert.equal(save.petInfo.yb, 95, 'automatic selection buys the lowest available unit price')
  assert.equal(save.petInfo.hunger, 699)
})

test('expired, disabled, dead and paused pets cannot spend or consume supplies', async () => {
  for (const blocked of ['expired', 'disabled', 'dead', 'paused']) {
    const { save, run, state } = await caring()
    save.settings.careAutoBuy = true
    if (blocked === 'expired') save.petInfo.sweetHeartOverTime = Date.now() / 1000 - 1
    if (blocked === 'disabled') save.petInfo.sweetHeart = false
    if (blocked === 'dead') save.petInfo.health = 0
    if (blocked === 'paused') save.settings.paused = true
    run()
    assert.equal(save.petInfo.yb, 100)
    assert.equal(state.uses, 0)
  }
})

test('cleaning and play have independent thresholds, item choices and the same purchase switch', async () => {
  const cleaning = await caring()
  Object.assign(cleaning.save.petInfo, { hunger: 1000, clean: 700 })
  Object.assign(cleaning.save.settings, { careCleanPercent: 80, careCleanId: '102020003' })
  cleaning.save.selfGoodDatas.clean = ['_10021008*2']
  cleaning.run()
  assert.equal(cleaning.save.petInfo.clean, 700, 'a missing selected cleaner does not consume another cleaner')
  assert.equal(cleaning.save.petInfo.yb, 100, 'the shared purchase switch is off by default')
  cleaning.save.settings.careAutoBuy = true
  cleaning.run()
  assert.equal(cleaning.save.petInfo.clean, 900)
  assert.equal(cleaning.save.petInfo.yb, 95)
  assert.deepEqual(Array.from(cleaning.save.selfGoodDatas.clean), ['_10021008*2'])

  const play = await caring()
  Object.assign(play.save.petInfo, { hunger: 1000, mood: 650 })
  Object.assign(play.save.settings, { careMoodPercent: 70, careToyId: 't0002' })
  play.save.selfGoodDatas.toy = ['_t0002*2']
  play.run()
  assert.equal(play.save.petInfo.mood, 700)
  assert.deepEqual(Array.from(play.save.selfGoodDatas.toy), ['_t0002*1'])
  assert.equal(play.save.petInfo.yb, 100)
  play.run()
  assert.equal(play.state.uses, 1, 'equality with the play threshold does not use another toy')
})

test('toy purchases enforce membership and level limits and only one need is handled per tick', async () => {
  const { save, run, state } = await caring()
  Object.assign(save.petInfo, { hunger: 1000, mood: 500, yb: 1000 })
  Object.assign(save.settings, { careAutoBuy: true, careToyId: 't0005' })
  save.selfGoodDatas.toy = []
  run()
  assert.equal(state.uses, 0, 'a pink diamond toy cannot be purchased without membership')
  assert.equal(save.petInfo.yb, 1000)
  save.settings.careToyId = 't0002'
  run()
  assert.equal(state.uses, 0, 'a locked toy cannot be purchased')
  save.petComputedlInfo.level = 5
  run()
  assert.equal(save.petInfo.mood, 550)
  assert.equal(save.petInfo.yb, 980)
  Object.assign(save.petInfo, { hunger: 599, clean: 599, mood: 599 })
  save.settings.careCleanId = '102020003'
  run()
  assert.equal(save.petInfo.hunger, 699)
  assert.equal(save.petInfo.clean, 599, 'food and cleaner are not consumed in the same tick')
  assert.equal(save.petInfo.yb, 975)
})

test('eighty-percent care remains effective for eight hours without animation callbacks', async () => {
  const { save, state, run } = await caring()
  Object.assign(save.petInfo, { hunger: 810, clean: 810, mood: 810 })
  Object.assign(save.settings, {
    careHungerPercent: 80, careCleanPercent: 80, careMoodPercent: 80,
    careFoodId: '102010001', careCleanId: '102020003', careToyId: 't0002',
  })
  save.selfGoodDatas.food = ['_102010001*30']
  save.selfGoodDatas.clean = ['_102020003*20']
  save.selfGoodDatas.toy = ['_t0002*30']
  state.defer = true
  for (let minute = 0; minute < 480; minute++) {
    save.petInfo.hunger -= 3
    save.petInfo.clean -= 3
    save.petInfo.mood -= 2
    run()
    assert.ok(save.petInfo.hunger >= 500 && save.petInfo.clean >= 500 && save.petInfo.mood >= 500,
      'supplies must take effect before low stats create illness risk, minute ' + minute)
  }
  assert.ok(save.petInfo.hunger >= 790)
  assert.ok(save.petInfo.clean >= 790)
  assert.ok(save.petInfo.mood >= 790)
  assert.equal(save.petInfo.yb, 100)
})

test('manual item use remains deferred and cannot double-consume a supply used by care', async () => {
  const { save, state, run, api } = await caring()
  save.selfGoodDatas.food = ['_102010001*1']
  state.defer = true
  api.useItem(api.goodOf('food', '102010001'))
  assert.equal(save.petInfo.hunger, 599)
  assert.deepEqual(Array.from(save.selfGoodDatas.food), ['_102010001*1'])
  assert.equal(state.pending.length, 1)
  run()
  assert.equal(save.petInfo.hunger, 699)
  assert.equal(state.uses, 1)
  for (const callback of state.pending) callback()
  assert.equal(save.petInfo.hunger, 699)
  assert.equal(state.uses, 1)
})
