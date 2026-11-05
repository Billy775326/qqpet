import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'
import { startSave, validatedImport } from '../src/shared/save-logic.ts'
import { loadMilestones, observeMilestones, hasFarmHarvest, MILESTONES } from '../src/renderer/pet/milestones.ts'

test('existing saves recognize real growth, lessons, exam diplomas, collections and mature fish', () => {
  const save = startSave(null)
  const p = loadMilestones(undefined, { Work: 2, Eat: 3 })
  Object.assign(save.petComputedlInfo, { level: 10 })
  save.petInfo.onLineTime = 65
  save.studyInfo.chinese = 9
  save.illustrated = ['a', 'a', 'b', null]
  save.gameSaveDatas.fishing_harvestfish = 7
  save.gameSaveDatas.yyds = 1
  assert.equal(observeMilestones(p, save), true)
  assert.equal(p.best.level, 10)
  assert.equal(p.best.primary, 0, 'finished lessons alone do not grant a diploma')
  assert.equal(p.best.Study, 9)
  assert.equal(p.best.collection, 2)
  assert.equal(p.best.fish, 100, 'master achievement preserves the previous 1000 harvests, capped at the highest goal')
  assert.equal(p.best.online, 65)
  assert.equal(p.counters.Work, 2)
  save.studyInfo.chinese = 10
  observeMilestones(p, save)
  assert.equal(p.best.primary, 1)
  assert.equal(p.best.Study, 9, 'passing an exam does not count as a lesson')
  save.studyInfo.chinese = 30
  observeMilestones(p, save)
  assert.equal(p.best.middle, 0)
  save.studyInfo.chinese = 31
  observeMilestones(p, save)
  assert.equal(p.best.middle, 1)
  assert.equal(observeMilestones(p, save), false, 'unchanged snapshots cause no extra writes')
})

test('farm evidence uses real SWF warehouse fields and stays complete after selling and replanting', () => {
  assert.equal(hasFarmHarvest('{invalid'), false)
  assert.equal(hasFarmHarvest('null'), false)
  assert.equal(hasFarmHarvest(JSON.stringify({ warehouse: [{ fruit: 'carrot', number: '0' }], farmland: [{ crop: 'carrot' }] })), false)
  const save = startSave(null)
  const p = loadMilestones(undefined, {})
  save.saveJsonData.farm = JSON.stringify({ warehouse: [{ fruit: 'carrot', number: '12' }], farmland: [] })
  observeMilestones(p, save)
  assert.equal(p.best.farm, 1)
  save.saveJsonData.farm = JSON.stringify({ warehouse: [], farmland: [{ crop: 'carrot' }] })
  observeMilestones(p, save)
  assert.equal(p.best.farm, 1)
  assert.equal(hasFarmHarvest(JSON.stringify({ farmland: [{ crop: 'carrot', harvest: 'xx' }] })), true)
})

test('milestone migration sanitizes permanent IDs and never seeds lifetime counters twice', () => {
  const p = loadMilestones(undefined, { Eat: 4, Work: 2 })
  p.claimed = ['first-meal', 'first-meal', 'unknown']
  p.counters.Work = 6
  const restored = loadMilestones(JSON.parse(JSON.stringify(p)), { Eat: 99, Work: 99 })
  assert.equal(restored.counters.Work, 6)
  assert.equal(restored.counters.Eat, 4)
  assert.deepEqual(restored.claimed, ['first-meal'])
  assert.equal(loadMilestones({ counters: { Eat: -1, Work: Infinity } }, {}).counters.Eat, 0)
  assert.equal(new Set(MILESTONES.map(t => t.id)).size, MILESTONES.length)
})

async function taskModel(save = startSave(null)) {
  const state = { save, rewards: [] as unknown[], writes: 0, day: 1000 }
  const stub = `const s=globalThis.state;export const save=s.save,info=save.petInfo;
    export const update=(k,v)=>{Object.assign(save[k],v);s.writes++};
    export const give=g=>s.rewards.push(g),loot=()=>[],rand=(min)=>min,dayStart=()=>s.day;`
  const result = await build({
    stdin: { contents: "export * from './tasks'", loader: 'ts', resolveDir: resolve('src/renderer/pet') },
    bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-tasks', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || ['./tasks', './milestones', './data/goods'].includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const module = { exports: {} as any }
  runInNewContext(result.outputFiles[0].text, { state, module, exports: module.exports })
  return { api: module.exports, state, save }
}

test('lifetime actions survive daily reset, tour reset, export/import and repeated claims', async () => {
  const save = startSave(null)
  save.havePet = true
  save.saveJsonData.task = JSON.stringify({ doNums: { Eat: 2, Work: 1 }, taskList: {} })
  const { api, state } = await taskModel(save)
  api.addCount('Eat')
  api.addCount('Work')
  assert.ok(api.claimMilestone('first-meal'))
  assert.equal(api.claimMilestone('first-meal'), false)
  assert.equal(api.claimMilestone('unknown'), false)
  assert.equal(api.claimMilestone('care-100'), false)
  save.gameSaveDatas.travel_china = Array.from({ length: 5 }, (_, i) => ({ name: String(i), value: 1 }))
  api.refreshMilestones()
  save.gameSaveDatas.travel_china = []
  api.resetTour()
  api.resetTasks()
  assert.equal(api.count('Eat'), 0)
  assert.equal(api.milestones().find((t: any) => t.id === 'first-meal').take, true)
  assert.equal(api.milestones().find((t: any) => t.id === 'provinces-5').done, 5)
  assert.equal(state.rewards.length, 1)
  const imported = validatedImport(JSON.parse(JSON.stringify(save)))
  const reloaded = await taskModel(imported)
  assert.equal(reloaded.api.claimMilestone('first-meal'), false)
  assert.ok(reloaded.api.claimMilestone('first-shift'))
  assert.equal(JSON.parse(imported.saveJsonData.task).milestones.counters.Work, 2)
  api.addCount('Work', NaN)
  api.addCount('Work', -1)
  assert.equal(api.count('Work'), 0)
})

test('daily and per-tour legacy rewards retain their indices and reset independently', async () => {
  const { api, save, state } = await taskModel()
  api.addCount('Study', 3)
  assert.ok(api.claim('growth', 1), 'claiming a later row uses its original index')
  assert.equal(api.tasks('growth')[0].take, false)
  assert.equal(api.tasks('growth')[1].take, true)
  assert.equal(api.claim('growth', 999), false)
  assert.equal(api.claim('growth', -1), false)
  save.gameSaveDatas.travel_china = Array.from({ length: 5 }, (_, i) => ({ name: String(i), value: 1 }))
  assert.ok(api.claim('travel', 2))
  api.resetTasks()
  assert.equal(api.tasks('growth')[1].take, false)
  assert.equal(api.tasks('travel')[2].take, true)
  api.resetTour()
  assert.equal(api.tasks('travel')[2].take, false)
  assert.equal(state.rewards.length, 2)
})

test('stale generated daily tasks cannot be claimed and all milestone reward IDs resolve', async () => {
  const save = startSave(null)
  save.saveJsonData.task = JSON.stringify({ dailyDay: 999, doNums: { Eat: 2 }, daily: [{ obj: 'Eat', num: 1 }], taskList: { daily: [{ take: false, good: [] }] } })
  const { api } = await taskModel(save)
  assert.equal(api.todayTasks().length, 0)
  assert.equal(api.claim('daily', 0), false)
  for (const t of api.milestones()) for (const good of t.good) {
    assert.ok(good.id, t.id)
    assert.ok(good.name, t.id)
    assert.ok(good.num > 0, t.id)
  }
})

test('new goals recognize saved cumulative amusement, higher diplomas and longer growth history', () => {
  const save = startSave(null)
  const p = loadMilestones({ counters: { Work: 120, GameRound: 50 }, best: { level: 20, fish: 10 }, claimed: ['level-20', 'first-meal'] }, {})
  save.gameSaveDatas.ddw = 1000
  save.gameSaveDatas.fishing_harvestfish = 70
  save.petComputedlInfo.level = 50
  save.petInfo.onLineTime = 43200
  save.studyInfo.chinese = 71
  observeMilestones(p, save)
  assert.equal(p.best.university, 0, 'the university exam must be passed')
  save.studyInfo.chinese = 72
  observeMilestones(p, save)
  assert.equal(p.best.university, 1)
  save.studyInfo.chinese = 167
  observeMilestones(p, save)
  assert.equal(p.best.postgraduate, 0)
  save.studyInfo.chinese = 168
  observeMilestones(p, save)
  assert.equal(p.best.postgraduate, 1)
  assert.equal(p.best.Amusing, 1000)
  assert.equal(p.best.Work, 120)
  assert.equal(p.best.fish, 70)
  assert.equal(p.best.level, 50)
  assert.equal(p.best.online, 43200)
  assert.equal(p.best.GameRound, 50)
  assert.deepEqual(p.claimed, ['level-20', 'first-meal'], 'catalogue expansion preserves existing claims')
})

test('permanent goals in daily tabs have stable identities and remain outside automatic dailies', async () => {
  const seed = startSave(null)
  seed.havePet = true
  seed.saveJsonData.task = JSON.stringify({ dailyDay: 1000 })
  const { api, save, state } = await taskModel(seed)
  save.gameSaveDatas.ddw = 100
  api.addCount('Work', 30)
  assert.equal(api.milestones('ddw').length, 6)
  assert.equal(api.milestones('growth').length, 12)
  assert.equal(api.milestones('milestones').length, 50)
  assert.equal(api.milestones().length, 68)
  assert.ok(api.claimMilestone('amusing-100'))
  assert.ok(api.claimMilestone('shifts-30'))
  assert.equal(api.claimMilestone('amusing-100'), false)
  api.resetTasks()
  api.resetTour()
  assert.equal(api.milestones('ddw').find((t: any) => t.id === 'amusing-100').take, true)
  assert.equal(api.milestones('growth').find((t: any) => t.id === 'shifts-30').take, true)
  assert.equal(state.rewards.length, 2)
  const restored = await taskModel(validatedImport(JSON.parse(JSON.stringify(save))))
  assert.equal(restored.api.claimMilestone('amusing-100'), false)
  assert.equal(restored.api.claimMilestone('shifts-30'), false)
  assert.equal(restored.api.dailyTasks().length, 11, 'daily automation retains only the original eleven fixed daily goals')
  assert.equal(restored.api.dailyTasks().some((t: { id?: string }) => t.id === 'amusing-100' || t.id === 'shifts-30'), false)
})
