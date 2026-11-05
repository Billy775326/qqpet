import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

async function dailyCare(kinds: string[], allDaily = false) {
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
    taskList: {
      daily: kinds.map(() => ({ take: false, good: [{ id: 'yb', name: '元宝', type: 'nums', num: 5, value: 1, url: '' }] })),
      // Focused cases start with the other daily rewards already claimed; full-scope cases load real defaults.
      ...(!allDaily ? Object.fromEntries([['ddw', 5], ['growth', 4], ['travel', 2]].map(([tab, n]) => [tab, Array.from({ length: n as number }, () => ({ take: true, good: [] }))])) : {}),
    },
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
  const entry = `export {runDailyCare} from './daily-care';export {tasks,count,addCount,dailyTasks,milestones,resetTasks} from './tasks';export {advanceTask} from './activity';export {resumeTask} from './jobs';export {goodOf} from './data/goods';`
  const allowed = ['./daily-care', './care', './jobs', './items', './goods', './tasks', './milestones', './activity', './data/goods', './vip', '../../shared/sweetheart']
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
  save.petInfo.hunger = 599
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
  Object.assign(save.petInfo, { hunger: 599, clean: 599 })
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

test('daily supply tasks respect each trigger limit before consuming stock or buying', async () => {
  const cases = [
    ['Eat', 'hunger', 'food', 'careHungerPercent', 'careFoodId', '102010001', 5],
    ['Clean', 'clean', 'clean', 'careCleanPercent', 'careCleanId', '102020003', 5],
    ['Toy', 'mood', 'toy', 'careMoodPercent', 'careToyId', 't0002', 20],
  ] as const
  for (const [counter, stat, type, limit, itemKey, id, cost] of cases) for (const owned of [false, true]) {
    const { save, api, run } = await dailyCare([counter])
    save.petComputedlInfo.level = 5
    save.settings.careAutoBuy = true
    save.settings[limit] = 70
    save.settings[itemKey] = id
    save.petInfo[stat] = 700
    save.selfGoodDatas[type] = owned ? [`_${id}*2`] : []
    const balance = save.petInfo.yb
    assert.equal(run(), false, 'the boundary must not use or purchase supplies')
    assert.equal(api.count(counter), 0)
    assert.equal(save.petInfo.yb, balance)
    assert.deepEqual(Array.from(save.selfGoodDatas[type]), owned ? [`_${id}*2`] : [])
    save.petInfo[stat] = 900
    assert.equal(run(), false, 'a sufficient stat must not be lowered to meet a task count')
    assert.equal(save.petInfo.yb, balance)
    save.petInfo[stat] = 699
    assert.equal(run(), true, 'a real need below the configured limit can advance the task')
    assert.equal(api.count(counter), 1)
    assert.equal(save.petInfo.yb, balance - (owned ? 0 : cost))
    assert.deepEqual(Array.from(save.selfGoodDatas[type]), owned ? [`_${id}*1`] : [])
  }
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
  assert.equal(api.tasks('growth')[0].take, true, 'previously claimed daily rewards remain claimed')
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

test('all daily goals share real actions, receive their own rewards once, and stop when finished', async () => {
  const { save, api, state, run } = await dailyCare(['Amusing', 'Study', 'Work', 'Travel1'], true)
  save.gameSaveDatas.travel_china = Array.from({ length: 35 }, (_, i) => ({ name: `region-${i}`, value: 1 }))
  for (let step = 0; step < 160; step++) {
    if (!run()) break
    if (save.activeOption.work || save.activeOption.study || save.activeOption.trip) {
      assert.equal(run(), false, 'one running activity cannot be replaced by another daily goal')
      api.advanceTask(10000)
    }
  }
  assert.ok(api.dailyTasks().length > 11)
  assert.equal(api.dailyTasks().every((t: { take: boolean }) => t.take), true)
  assert.equal(api.count('Amusing'), 25)
  assert.equal(api.count('Study'), 3, 'one lesson advances generated and static goals together')
  assert.equal(api.count('Work'), 3)
  assert.equal(api.count('Travel1'), 5)
  assert.equal(state.amused, 25)
  assert.ok(save.selfGoodDatas.nums.includes('_yb*70'), 'four generated rewards and the real 50-yuanbao work reward reach the inventory')
  assert.equal(api.tasks('travel').slice(2).every((t: { take: boolean }) => !t.take), true, 'ready per-tour rewards stay manual')
  assert.equal(api.milestones().every((t: { take: boolean }) => !t.take), true, 'permanent growth rewards stay manual')
  const inventory = JSON.stringify(save.selfGoodDatas)
  assert.equal(run(), false)
  assert.equal(run(), false)
  assert.equal(JSON.stringify(save.selfGoodDatas), inventory, 'finished dailies never grant again')
  api.resetTasks()
  assert.equal(api.count('Amusing'), 0)
  assert.equal(api.tasks('ddw')[0].take, false)
  assert.equal(run(), true, 'daily-reset goals become eligible again after reset')
})

test('unclaimed daily rewards are auto-claimed across tabs even without a matching generated goal', async () => {
  const { save, api, state, run } = await dailyCare([], true)
  api.addCount('Amusing', 25)
  api.addCount('Study', 3)
  api.addCount('Work', 3)
  api.addCount('Travel1', 5)
  save.gameSaveDatas.travel_china = Array.from({ length: 10 }, (_, i) => ({ name: String(i), value: 1 }))
  const daily = api.dailyTasks()
  assert.equal(daily.length, 11)
  for (let i = 0; i < daily.length; i++) assert.equal(run(), true)
  assert.equal(run(), false)
  assert.equal(state.amused, 0, 'ready rewards require no extra actions')
  assert.equal(api.tasks('travel')[0].take, true)
  assert.equal(api.tasks('travel')[1].take, true)
  assert.equal(api.tasks('travel')[2].take, false)
  assert.equal(save.activeOption.work, null)
  assert.equal(save.activeOption.study, null)
  assert.equal(save.activeOption.trip, null)
})

test('day rollover blocks every daily source until the new day is initialized', async () => {
  const { state, api, run } = await dailyCare([], true)
  api.addCount('Amusing', 5)
  state.now += 86400 * 1000
  assert.equal(api.dailyTasks().length, 0)
  assert.equal(run(), false)
  assert.equal(api.tasks('ddw')[0].take, false)
  assert.equal(state.amused, 0)
})
