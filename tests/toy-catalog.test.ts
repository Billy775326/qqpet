import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

const catalogue = JSON.parse(readFileSync('src/renderer/pet/data/goods.json', 'utf8'))
const shop = JSON.parse(readFileSync('src/renderer/pet/data/shop.json', 'utf8'))
const toys = Object.values(catalogue.toy) as {id: string; name: string; url: string; needLevel: number; price: number; mood: number; charm: number; intel: number; strong: number}[]
const added = toys.filter(g => Number(g.id.slice(1)) >= 9)

async function model(save = startSave(null)) {
  save.havePet = true
  const state = { save, disk: structuredClone(save), applyPatch, pending: [] as (() => void)[], alerts: 0 }
  const stub = `const s=globalThis.state;
    export const save=s.save, info=save.petInfo, activity=()=>null;
    export const update=(key,value)=>{if(Array.isArray(value))save[key]=value;else Object.assign(save[key],value);s.applyPatch(s.disk,{[key]:value})};
    export const commit=patch=>{s.applyPatch(s.disk,patch);for(const [key,value]of Object.entries(patch)){if(Array.isArray(value))save[key]=value;else Object.assign(save[key],value)}};
    export const setInfo=(key,value)=>update('petInfo',{[key]:value}),addInfo=(key,n)=>setInfo(key,info[key]+n);
    export const speak=(_line,_action,hooks={})=>{if(hooks.start)s.pending.push(hooks.start)};
    export const floatMood=()=>{},windowView=()=>s.alerts++,loot=()=>[],rand=min=>min,dayStart=()=>1000;
    export const DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}});`
  const result = await build({
    stdin: { contents: "export * from './items';export * from './goods';export * from './tasks';export * from './care';export * from './data/goods'", resolveDir: resolve('src/renderer/pet'), loader: 'ts' },
    bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-toys', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || ['./items','./goods','./inventory','./tasks','./milestones','./care','./data/goods'].includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const module = { exports: {} as any }
  runInNewContext(result.outputFiles[0].text, { state, module, exports: module.exports, Date })
  return { api: module.exports, state, save }
}

test('all nineteen restored toy images resolve to unique usable catalogue, shop and task entries', async () => {
  assert.equal(added.length, 19)
  assert.equal(toys.length, 27)
  const ids = Object.values(catalogue).flatMap(group => Object.values(group as object).map((g: any) => g.id))
  for (const g of added) assert.equal(ids.filter(id => id === g.id).length, 1, 'new IDs never collide across types')
  assert.deepEqual(shop.shopGN.toy[0], Array.from({length: 8}, (_, i) => 't' + String(i + 1).padStart(4,'0')))
  const { api } = await model()
  const goals = api.milestones()
  for (const g of added) {
    assert.ok(existsSync(resolve('resources', g.url)), g.name)
    assert.ok(g.name && g.mood > 0 && g.price > 0 && g.needLevel >= 1)
    assert.ok(Number.isInteger(g.price * 0.8), 'discounted prices remain whole currency units')
    assert.equal(shop.shopGN.toy.flat().filter((id: string) => id === g.id).length, 1)
    const matches = goals.flatMap((t: any) => t.good.filter((r: any) => r.id === g.id))
    assert.equal(matches.length, 1, g.name + ' has a fixed growth reward')
    assert.equal(matches[0].num, 1)
    assert.equal(matches[0].type, 'toy')
    assert.ok(!g.id.includes('__'))
  }
  assert.ok(shop.shopGN.toy.every((page: string[]) => page.length > 0 && page.length <= 8))
  assert.equal(new Set(goals.flatMap((g: any) => g.good.filter((r: any) => r.type !== 'nums').map((r: any) => r.id))).size, 54)
  assert.equal(goals.reduce((sum: number, t: any) => sum + t.good.filter((g: any) => g.id === 'yb').reduce((n: number, g: any) => n+g.num,0),0), 2300)
})

test('new toys can be bought repeatedly at their level, honor membership discounts and preserve money on refusal', async () => {
  const { api, save } = await model()
  save.petInfo.yb = 10000
  save.selfGoodDatas.toy = []
  for (const row of added) {
    const g = api.goodOf('toy', row.id)
    const before = save.petInfo.yb
    save.petComputedlInfo.level = row.needLevel - 1
    assert.equal(api.buy(g), false)
    assert.equal(save.petInfo.yb, before)
    assert.equal(api.hasGood('toy',g.id), false)
    save.petComputedlInfo.level = row.needLevel
    assert.equal(api.buy(g), true)
    assert.equal(api.buy(g), true)
    assert.equal(save.petInfo.yb, before - 2*row.price)
    assert.ok(save.selfGoodDatas.toy.includes(`_${g.id}*2`))
    assert.equal(save.illustrated.filter(id => id === g.id).length, 1)
  }
  save.petInfo.pinkDiamond = true
  const before = save.petInfo.yb
  assert.equal(api.buy(api.goodOf('toy','t0027')), true)
  assert.equal(save.petInfo.yb, before - 110*0.8)
  save.petInfo.yb = 0
  const inventory = [...save.selfGoodDatas.toy]
  assert.equal(api.buy(api.goodOf('toy','t0027')), false)
  assert.deepEqual(Array.from(save.selfGoodDatas.toy), inventory)
  assert.equal(save.petInfo.yb, 0)
})

test('each new toy consumes one at animation start, applies declared benefits and survives save reload', async () => {
  const { api, state, save } = await model()
  save.havePet = true
  save.selfGoodDatas.toy = added.map(g => `_${g.id}*2`)
  const originals = { ...save.petInfo }
  let charm = 0, intel = 0, strong = 0
  for (const row of added) {
    save.petInfo.mood = 990
    const g = api.goodOf('toy',row.id)
    api.useItem(g)
    assert.ok(save.selfGoodDatas.toy.includes(`_${row.id}*2`),'animation preemption does not consume inventory')
    assert.equal(save.petInfo.mood,990)
    state.pending.shift()!()
    assert.ok(save.selfGoodDatas.toy.includes(`_${row.id}*1`))
    assert.equal(save.petInfo.mood,1000)
    charm+=row.charm; intel+=row.intel; strong+=row.strong
    assert.equal(save.selfGoodUseOption.toy,null,'no invented timed effects')
  }
  assert.equal(save.petInfo.charm,originals.charm+charm)
  assert.equal(save.petInfo.intel,originals.intel+intel)
  assert.equal(save.petInfo.strong,originals.strong+strong)
  assert.equal(api.count('Toy'),19)
  const restored = await model(validatedImport(JSON.parse(JSON.stringify(state.disk))))
  assert.deepEqual(restored.save.selfGoodDatas.toy,Array.from(save.selfGoodDatas.toy))
  for(const g of added) assert.equal(restored.api.listGoods('toy',1,100).list.find((r: any)=>r.id===g.id).name,g.name)
  restored.save.settings.paused = true
  restored.api.useItem(restored.api.goodOf('toy','t0009'))
  assert.equal(restored.state.pending.length,0)
  assert.ok(restored.save.selfGoodDatas.toy.includes('_t0009*1'))
})

test('unclaimed growth goals add their new toys once while previous claims stay claimed across resets and import', async () => {
  const seed = startSave(null)
  seed.saveJsonData.task = JSON.stringify({milestones:{best:{care:1000,Toy:50,Amusing:3000,GameRound:50,collection:100,Clean:50,Eat:50,Work:300,Study:300,farm:1},claimed:['first-toy']}})
  seed.selfGoodDatas.toy = ['_t0002*2']
  const { api, save } = await model(seed)
  const goals = api.milestones().filter((g: any) => g.good.some((r: any) => added.some(t => t.id===r.id)))
  assert.equal(goals.length,19)
  for(const goal of goals) {
    if(goal.id==='first-toy') {assert.equal(api.claimMilestone(goal.id),false);continue}
    const reward = api.claimMilestone(goal.id)
    assert.ok(reward,goal.id)
    const toy=reward.find((r: any)=>added.some(t=>t.id===r.id))
    assert.ok(save.selfGoodDatas.toy.includes(`_${toy.id}*1`),goal.id)
    assert.equal(api.claimMilestone(goal.id),false)
  }
  assert.ok(!api.hasGood('toy','t0009'),'claimed legacy goals do not retroactively receive added toys')
  api.resetTasks()
  const restored=await model(validatedImport(JSON.parse(JSON.stringify(save))))
  for(const goal of goals) assert.equal(restored.api.claimMilestone(goal.id),false)
  assert.ok(restored.save.selfGoodDatas.toy.includes('_t0002*4'),'original two baseballs plus the two unchanged baseball rewards are preserved')
})

test('care can select and purchase a new toy without bypassing levels or buying twice', async () => {
  const { api, save } = await model()
  save.selfGoodDatas.toy=[]
  Object.assign(save.settings,{careToyId:'t0012',careAutoBuy:true})
  Object.assign(save.petInfo,{sweetHeart:true,sweetHeartOverTime:Date.now()/1000+86400,hunger:1000,clean:1000,mood:590,yb:100})
  save.petComputedlInfo.level=2
  assert.equal(api.selfCare(),false)
  assert.equal(save.petInfo.yb,100)
  save.petComputedlInfo.level=3
  assert.equal(api.selfCare(),true)
  assert.equal(save.petInfo.yb,85)
  assert.equal(save.petInfo.mood,630)
  assert.equal(api.count('Toy'),1)
  assert.equal(api.selfCare(),false)
  assert.equal(save.petInfo.yb,85)
})
