import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

async function dailyCare(kinds: string[]) {
  const save = startSave(null)
  save.havePet = true
  Object.assign(save.petInfo, { sweetHeart: true, sweetHeartOverTime: Date.now() / 1000 + 3 * 86400, health: 5, hunger: 1000, clean: 1000, mood: 1000 })
  Object.assign(save.petComputedlInfo, { level: 2, hungerMax: 1000, cleanMax: 1000 })
  save.settings.careAutoDaily = true
  const day = new Date()
  day.setHours(6, 0, 0, 0)
  if (day.getTime() > Date.now()) day.setDate(day.getDate() - 1)
  save.saveJsonData.task = JSON.stringify({
    dailyDay: day.getTime() / 1000,
    daily: kinds.map(obj => ({ label: obj, msg: obj, obj, num: 1 })),
    doNums: {},
    taskList: { daily: kinds.map(() => ({ take: false, good: [{ id: 'yb', name: '元宝', type: 'nums', num: 5, value: 1, url: '' }] })) },
  })
  const state = { save, now: Date.now(), idle: true, hover: false, ui: false, amused: 0, exams: 0, alerts: 0, addCount: (_key: string) => {} }
  const stub = `
    const state=globalThis.state;
    export const save=state.save,info=save.petInfo,activity=key=>save.activeOption[key];
    export const busy=()=>Boolean(activity('work')||activity('study')||activity('trip'));
    export const update=(group,patch)=>{if(Array.isArray(patch))save[group]=patch;else Object.assign(save[group],patch)},setInfo=(key,value)=>info[key]=value,addInfo=(key,n)=>info[key]+=n,setActivity=(key,value)=>save.activeOption[key]=value,refreshTray=()=>{};
    export const machine={get idle(){return state.idle}};
    export const speak=(_line,_action,hooks={})=>hooks.start?.();
    export const amusePet=()=>{state.amused++;state.addCount('Amusing');return true};
    export const windowView=()=>state.alerts++,openExam=()=>state.exams++,floatMood=()=>{},openEmail=()=>{},tripBack=()=>{},isBuddy=()=>false,takePhoto=()=>null,mailPhoto=()=>{},loot=()=>[],resetFish=()=>{},rand=(_min,max)=>max,luck=()=>0;
    export const DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}});
  `
  const entry = `export {runDailyCare} from './daily-care';export {tasks,count,addCount} from './tasks';export {advanceTask} from './activity';export {resumeTask} from './jobs';export {goodOf} from './data/goods';`
  const allowed = ['./daily-care', './care', './jobs', './items', './goods', './tasks', './activity', './data/goods', './vip', '../../shared/sweetheart']
  const bundle = await build({ stdin: { contents: entry, resolveDir: resolve('src/renderer/pet'), loader: 'ts' }, bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-daily-care', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || allowed.includes(args.path) || args.path.endsWith('.json')) return
      return { path: args.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
  } }] })
  class Clock extends Date { static now() { return state.now } }
  const module = { exports: {} as any }
  const document = { documentElement: { classList: { contains: () => state.hover } }, querySelector: () => state.ui ? {} : null }
  runInNewContext(bundle.outputFiles[0].text, { state, module, exports: module.exports, Date: Clock, document })
  state.addCount = module.exports.addCount
  return { save, state, api: module.exports, run: module.exports.runDailyCare as () => boolean }
}

test('automatic daily completion defaults off and persists only after explicit configuration', () => {
  const save = startSave(null)
  save.havePet = true
  const raw = JSON.parse(JSON.stringify(save))
  delete raw.settings.careAutoDaily
  const restored = startSave(raw)
  assert.equal(restored.settings.careAutoDaily, false)
  applyPatch(restored, { settings: { careAutoDaily: true } })
  assert.equal(validatedImport(JSON.parse(JSON.stringify(restored))).settings.careAutoDaily, true)
})

test('daily feeding consumes a real configured item and rewards are claimed exactly once', async () => {
  const { save, api, run } = await dailyCare(['Eat'])
  save.settings.careFoodId = '102010001'
  save.selfGoodDatas.food = ['_102010001*2']
  assert.equal(run(), true)
  assert.equal(api.count('Eat'), 1)
  assert.deepEqual(Array.from(save.selfGoodDatas.food), ['_102010001*1'])
  assert.equal(api.tasks('daily')[0].take, false)
  assert.equal(run(), true)
  assert.equal(api.tasks('daily')[0].take, true)
  assert.deepEqual(Array.from(save.selfGoodDatas.nums), ['_yb*5'])
  assert.equal(run(), false)
  assert.deepEqual(Array.from(save.selfGoodDatas.nums), ['_yb*5'])
})

test('daily supplies honor the purchase switch and skip blocked needs without fake progress', async () => {
  const { save, api, state, run } = await dailyCare(['Eat', 'Clean'])
  save.settings.careFoodId = '102010001'
  save.selfGoodDatas.food = []
  save.settings.careCleanId = '102020003'
  save.selfGoodDatas.clean = []
  assert.equal(run(), false)
  assert.equal(api.count('Eat'), 0)
  save.settings.careAutoBuy = true
  const balance = save.petInfo.yb
  run()
  assert.equal(save.petInfo.yb, balance - 5)
  assert.equal(api.count('Eat'), 1)
  assert.equal(api.count('Clean'), 0, 'one round cannot consume multiple categories')
  assert.equal(state.alerts, 0)
})

test('work, study and travel keep their real timers and do not replace a running activity', async () => {
  for (const [counter, key, type] of [['Work', 'work', 'work'], ['Study', 'study', 'study'], ['Travel1', 'trip', null]] as const) {
    const { save, api, state, run } = await dailyCare([counter])
    save.saveJsonData.activity = '999'
    assert.equal(run(), true)
    const id = save.activeOption[key] as string
    assert.ok(id)
    assert.equal(save.saveJsonData.activity, '0', 'a fresh activity cannot inherit stale saved minutes')
    assert.equal(api.count(counter), 0, 'starting is not completion')
    assert.equal(run(), false)
    assert.equal(save.activeOption[key], id)
    const duration = type ? api.goodOf(type, id).useTime : 60
    api.advanceTask(duration - 1)
    assert.equal(api.count(counter), 0, 'the normal duration has not elapsed')
    save.nowTimeLine = state.now / 1000
    api.resumeTask()
    assert.equal(save.saveJsonData.activity, String(duration - 1), 'resuming preserves the current activity progress')
    api.advanceTask(1)
    assert.equal(api.count(counter), 1)
    assert.equal(save.activeOption[key], null)
    assert.equal(run(), true)
    assert.equal(api.tasks('daily')[0].take, true)
  }
})

test('promotion exams and minigames remain manual without blocking other supported tasks', async () => {
  const { save, api, state, run } = await dailyCare(['GameRound', 'Game', 'Study'])
  for (const key of Object.keys(save.studyInfo) as (keyof typeof save.studyInfo)[]) save.studyInfo[key] = 9
  assert.equal(run(), false, 'all primary courses await manual exams')
  assert.equal(state.exams, 0)
  save.studyInfo.mathematics = 8
  assert.equal(run(), true)
  assert.equal(save.activeOption.study, 'xx-mathematics')
  api.advanceTask(45)
  assert.equal(save.studyInfo.mathematics, 9)
  assert.equal(state.exams, 0)
  assert.equal(api.count('GameRound'), 0)
  assert.equal(api.count('Game'), 0)
  run()
  assert.equal(api.tasks('daily')[2].take, true)
  assert.equal(api.tasks('daily')[0].take, false)
  assert.equal(api.tasks('growth')[0].take, false, 'other task tabs are not automatically claimed')
  api.addCount('GameRound')
  run()
  assert.equal(api.tasks('daily')[0].take, true, 'manually finished minigames can have their daily reward claimed')
  api.addCount('Game')
  run()
  assert.equal(api.tasks('daily')[1].take, true)
})

test('amusement uses the existing interaction and old daily lists are not reused across 06:00', async () => {
  const { state, api, run } = await dailyCare(['Amusing'])
  assert.equal(run(), true)
  assert.equal(state.amused, 1)
  assert.equal(api.count('Amusing'), 1)
  state.now += 86400 * 1000
  assert.equal(run(), false)
  assert.equal(api.tasks('daily')[0].take, false)
})

test('disabled service, illness, pause and user interaction block unattended actions and rewards', async () => {
  for (const reason of ['off', 'expired', 'serviceOff', 'ill', 'paused', 'hover', 'window', 'animation']) {
    const { save, api, state, run } = await dailyCare(['Eat'])
    api.addCount('Eat')
    if (reason === 'off') save.settings.careAutoDaily = false
    if (reason === 'expired') save.petInfo.sweetHeartOverTime = state.now / 1000 - 1
    if (reason === 'serviceOff') save.petInfo.sweetHeart = false
    if (reason === 'ill') save.petInfo.health = 4
    if (reason === 'paused') save.settings.paused = true
    if (reason === 'hover') state.hover = true
    if (reason === 'window') state.ui = true
    if (reason === 'animation') state.idle = false
    assert.equal(run(), false, reason)
    assert.equal(api.tasks('daily')[0].take, false)
  }
})
