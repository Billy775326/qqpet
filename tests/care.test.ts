import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
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
    export const speak=(_line,_action,hooks={})=>{if(hooks.start){state.uses++;if(state.defer)state.pending.push(hooks.start);else hooks.start()}};
    export const windowView=()=>state.alerts++,floatMood=()=>{},addCount=()=>{};
    export const DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}});
  `
  const built = await build({ entryPoints: ['src/renderer/pet/care.ts'], bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-care', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || ['./data/goods', './goods', './items'].includes(args.path) || args.path.endsWith('.json')) return
      return { path: args.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
  } }] })
  const module = { exports: {} as { selfCare: () => void } }
  runInNewContext(built.outputFiles[0].text, { state, module, exports: module.exports, Date })
  return { state, save, run: module.exports.selfCare }
}

test('old saves keep the existing feeding threshold and never enable automatic purchases', () => {
  const old = startSave(null)
  old.havePet = true
  const raw = JSON.parse(JSON.stringify(old))
  delete raw.settings.careHungerPercent
  delete raw.settings.careFoodId
  delete raw.settings.careAutoBuy
  const restored = startSave(raw)
  assert.equal(restored.settings.careHungerPercent, 60)
  assert.equal(restored.settings.careFoodId, '')
  assert.equal(restored.settings.careAutoBuy, false)
  assert.deepEqual(restored.selfGoodDatas, old.selfGoodDatas)
  applyPatch(restored, { settings: { careHungerPercent: 75, careFoodId: '102010001', careAutoBuy: true } })
  const imported = validatedImport(JSON.parse(JSON.stringify(restored)))
  assert.equal(imported.settings.careHungerPercent, 75)
  assert.equal(imported.settings.careFoodId, '102010001')
  assert.equal(imported.settings.careAutoBuy, true)
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

test('automatic purchasing buys one selected item, honors the discount, and cannot charge twice before consumption', async () => {
  const { save, run, state } = await caring()
  save.settings.careFoodId = '102010001'
  save.settings.careAutoBuy = true
  save.petInfo.pinkDiamond = true
  state.defer = true
  run()
  assert.equal(save.petInfo.yb, 96)
  assert.deepEqual(Array.from(save.selfGoodDatas.food), ['_102010001*1'])
  run()
  assert.equal(save.petInfo.yb, 96)
  for (const start of state.pending) start()
  assert.equal(save.petInfo.hunger, 699)
  assert.deepEqual(Array.from(save.selfGoodDatas.food), [])
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
