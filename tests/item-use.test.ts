import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

let serial = 0
async function model(protection: Record<string, 'rare' | 'discontinued'> = {}, seed = startSave(null)) {
  seed.havePet = true
  const state = { disk: structuredClone(seed), dialogs: [] as any[], pending: [] as (() => void)[], protection, counts: 0, fail: false }
  const mock = `const state=window.fixture;
    export const touch=false,floatMood=()=>{},rand=min=>min,addCount=()=>state.counts++;
    export const DEAD={cure:{id:'60001'}},illOf=()=>({cure:{id:'10001'},successTolk:'healed',errTolk:'wrong'});
    export const speak=(_l,_a,h={})=>{if(h.start)state.pending.push(h.start);if(h.end)state.pending.push(h.end)};
    export const windowView=d=>{state.dialogs.push(d);return ()=>d.onClose?.()};`
  const result = await build({
    stdin: { contents: "export * from './items';export * from './care';export * from './goods';export * from './acquisition';export * from './data/goods';export {save,info,update} from './store'", resolveDir: resolve('src/renderer/pet'), loader: 'ts' },
    bundle: true, write: false, format: 'esm', plugins: [{ name: 'isolated-item-use', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) || ['./items','./care','./goods','./inventory','./store','./level','./acquisition','./data/goods','./data/task-definitions','./milestones','../../shared/save-logic'].includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: mock }))
      // Override only fixture rarity labels; the real last-copy and warning logic stays bundled.
      b.onLoad({ filter: /rarity\.ts$/ }, args => ({ contents: readFileSync(args.path, 'utf8').replace(
        "byId.get(g.id) ?? 'common'", "window.fixture.protection[g.id] ?? byId.get(g.id) ?? 'common'"
      ), loader: 'ts' }))
    } }],
  })
  // Persistence uses the actual save validator and an isolated in-memory disk.
  const bridge = { fixture: state, qqpet: { load: async () => structuredClone(state.disk), save: (patch: any) => {
    if (state.fail) throw Error('Simulated disk failure')
    const next = structuredClone(state.disk); applyPatch(next, patch); state.disk = next
  } } }
  ;(globalThis as any).__itemFixture = bridge
  const code = 'const window=globalThis.__itemFixture;\n' + result.outputFiles[0].text + `\n// model ${serial++}`
  const api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  delete (globalThis as any).__itemFixture
  const confirm = (d = state.dialogs.at(-1), n = 1) => d.ok(() => d.onClose?.(), n)
  return { api, state, save: api.save, info: api.info, confirm }
}

test('reviewed classifications protect actual rare and historical goods independently of repeated reward routes', async () => {
  const { api } = await model()
  assert.equal(api.availability(api.goodOf('food','100010044')), 'rare')
  assert.equal(api.availability(api.goodOf('food','100010390')), 'discontinued')
  assert.equal(api.availability(api.goodOf('food','100010282')), 'common', 'a currently sold item overrides its legacy event description')
  assert.equal(api.availability(api.goodOf('food','100010106')), 'collectible', 'a separate recurring birthday source lowers rarity')
  assert.equal(api.needsUseConfirmation({id:'100010390'},2,1),false)
  assert.equal(api.needsUseConfirmation({id:'100010390'},2,2),true)
  assert.equal(api.needsUseConfirmation({id:'100010044'},1,1),true)
  assert.equal(api.needsUseConfirmation({id:'100010106'},1,1),false)
  assert.equal(api.needsUseConfirmation({id:'100010390'},0,1),false)
  const before=api.availability({id:'100010390'})
  assert.equal(api.availability({...api.goodOf('food','100010390'),price:1,outOfPrint:false,num:20}),before)
})

test('only the last copy requires explicit consent; cancel and retained controls never consume', async () => {
  for (const [type,id] of [['food','100010044'],['food','100010390'],['clean','100020032'],['background','b0000012']]) {
    const { api, state, save, confirm }=await model()
    api.update('selfGoodDatas',{[type]:[`_${id}*2`]})
    const g=api.goodOf(type,id)
    api.useItem(g)
    assert.equal(state.dialogs.length,0)
    state.pending.shift()!()
    assert.equal(api.quantityOf(type,id),1)
    const before=JSON.stringify(save)
    api.useItem(g)
    const cancelled=state.dialogs.at(-1)
    assert.equal(cancelled.cancel,true)
    assert.match(cancelled.msg(),/用尽背包 1 份/)
    cancelled.onClose();confirm(cancelled)
    assert.equal(JSON.stringify(save),before)
    api.useItem(g);confirm()
    const pending=state.pending.shift()!
    pending();pending();confirm()
    assert.equal(api.quantityOf(type,id),0)
    assert.equal(state.counts,type==='background'?0:2)
  }
})

test('an animation that becomes the last use waits for consent, and cancellation invalidates its old callback', async () => {
  const { api, state, save, confirm }=await model()
  const g=api.goodOf('food','100010390')
  api.update('selfGoodDatas',{food:['_100010390*2']})
  api.useItem(g)
  const pending=state.pending.shift()!
  api.takeGood(g)
  const before=JSON.stringify(save)
  pending();pending()
  assert.equal(state.dialogs.length,1)
  assert.equal(JSON.stringify(save),before)
  const cancelled=state.dialogs.at(-1)
  cancelled.onClose();pending();confirm(cancelled)
  assert.equal(state.dialogs.length,1)
  assert.equal(JSON.stringify(save),before)
  api.useItem(g);confirm();state.pending.shift()!()
  assert.equal(api.quantityOf('food',g.id),0)
  assert.equal(state.counts,1)
})

test('quantity confirmations show the last-copy warning only when consuming the whole live stack', async () => {
  const { api, state, save, info, confirm }=await model({growth:'rare'})
  api.update('selfGoodDatas',{nums:['_growth*5']})
  const g=api.goodOf('nums','growth'),before=info.growth
  api.useItem(g)
  const d=state.dialogs.at(-1)
  assert.equal(d.initial,1)
  assert.equal(d.cancel,true)
  assert.equal(d.reviewKey(2),false)
  assert.equal(d.reviewKey(5),true)
  assert.doesNotMatch(d.msg(2),/用尽/)
  assert.match(d.msg(5),/用尽背包 5 份/)
  confirm(d,2);confirm(d,2)
  assert.equal(api.quantityOf('nums','growth'),3)
  assert.equal(info.growth,before+2*g.value)
  api.useItem(g)
  const cancelled=state.dialogs.at(-1),snapshot=JSON.stringify(save)
  cancelled.onClose();confirm(cancelled,3)
  assert.equal(JSON.stringify(save),snapshot)
  api.useItem(g);confirm(undefined,3)
  assert.equal(api.quantityOf('nums','growth'),0)
  assert.equal(info.growth,before+5*g.value)
})

test('failed writes and pause changes keep the protected last copy intact', async () => {
  const { api, state, save, confirm }=await model()
  const g=api.goodOf('food','100010390')
  api.update('selfGoodDatas',{food:['_100010390*1']})
  api.useItem(g);save.settings.paused=true;confirm()
  assert.equal(state.pending.length,0)
  save.settings.paused=false
  api.useItem(g);confirm()
  const pending=state.pending.shift()!,before=JSON.stringify(save)
  state.fail=true
  assert.throws(()=>pending(),/disk failure/)
  assert.equal(JSON.stringify(save),before)
  state.fail=false;pending();pending()
  assert.equal(api.quantityOf('food',g.id),0)
  assert.equal(state.counts,1)
})

test('medicine keeps living-pet warnings and right/wrong animation timing without consuming doctor-paid stock', async () => {
  const { api, state, info, confirm }=await model({'60001':'rare','10001':'discontinued','10002':'rare'})
  api.update('selfGoodDatas',{medicine:['_60001*1','_10001*1','_10002*1']})
  info.health=3
  api.useItem(api.goodOf('medicine','60001'))
  assert.match(state.dialogs.at(-1).msg(),/尚未死亡/)
  confirm()
  assert.equal(state.dialogs.length,1)
  assert.equal(info.health,5)
  assert.equal(api.quantityOf('medicine','60001'),0)
  const length=state.dialogs.length
  api.useItem(api.goodOf('medicine','10001'))
  assert.equal(state.dialogs.length,length)
  info.health=3
  api.useItem(api.goodOf('medicine','10001'),true)
  state.pending.shift()!()
  assert.equal(info.health,5)
  assert.equal(api.quantityOf('medicine','10001'),1)
  info.health=3
  api.useItem(api.goodOf('medicine','10002'));confirm()
  assert.equal(info.health,3)
  state.pending.shift()!()
  assert.equal(info.health,2)
  assert.equal(api.quantityOf('medicine','10002'),0)
})

test('care uses spare copies but reserves the final rare or historical copy and preserves old preferences on import', async () => {
  const { api, state, save, info }=await model()
  info.health=5;info.hunger=1;info.clean=save.petComputedlInfo.cleanMax;info.mood=save.petComputedlInfo.moodMax
  info.sweetHeart=true;info.sweetHeartOverTime=Date.now()/1000+10000
  api.update('selfGoodDatas',{food:['_100010390*2']})
  api.update('settings',{careFoodId:'100010390',careAutoBuy:true})
  assert.equal(api.selfCare(),true)
  assert.equal(api.quantityOf('food','100010390'),1)
  info.hunger=1
  const before=JSON.stringify(save)
  for(let i=0;i<5;i++)assert.equal(api.selfCare(),false)
  assert.equal(api.useCareItem(api.goodOf('food','100010390'),'care'),false)
  assert.equal(JSON.stringify(save),before)
  assert.equal(state.dialogs.length,0)
  api.update('settings',{careFoodId:'',careAutoBuy:false})
  api.addGood('food','102010003',1)
  assert.equal(api.selfCare(),true)
  assert.equal(api.quantityOf('food','100010390'),1)
  api.update('settings',{careFoodId:'100010390'})
  const imported=validatedImport(structuredClone(state.disk))
  assert.equal(imported.settings.careFoodId,'100010390')
  assert.ok(imported.selfGoodDatas.food.includes('_100010390*1'))
})
