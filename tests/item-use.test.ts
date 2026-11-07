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
        if (!args.importer || ['./items','./care','./goods','./inventory','./store','./level','./acquisition','./data/goods','./data/task-definitions','./milestones','../../shared/save-logic'].includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: mock }))
      // Alter only test source opportunities, keeping the real classifier and warning text.
      b.onLoad({ filter: /acquisition\.ts$/ }, args => ({ contents: readFileSync(args.path, 'utf8').replace(
        "sources.get(g.id) ?? []",
        "window.fixture.protection[g.id] === 'rare' ? [{key:'test-lifetime-goal',repeatable:false}] : window.fixture.protection[g.id] === 'discontinued' ? [] : sources.get(g.id) ?? []"
      ), loader: 'ts' }))
    } }],
  })
  // The actual acquisition module must resolve normally inside the source substitution.
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

test('source audit gives repeatable routes precedence and ignores sale labels, cheats and current stock', async () => {
  const { api } = await model()
  assert.equal(api.classifySources([]), 'discontinued')
  assert.equal(api.classifySources([{ key: 'once-per-save', repeatable: false }]), 'rare')
  assert.equal(api.classifySources([{ key: 'goal-a', repeatable: false }, { key: 'goal-b', repeatable: false }]), 'limited')
  assert.equal(api.classifySources([{ key: 'once-per-save', repeatable: false }, { key: 'once-per-save', repeatable: false }]), 'rare')
  assert.equal(api.classifySources([{ key: 'once-per-save', repeatable: false }, { key: 'daily', repeatable: true }]), 'repeatable')
  let total = 0, protectedCount = 0
  for (const type of ['food','clean','medicine','toy','nums','background'])
    for (const g of api.allGoods(type)) {
      total++
      if (api.needsUseConfirmation(g)) protectedCount++
      assert.equal(api.availability({ ...g, price: -1, outOfPrint: true, num: 0 }), api.availability(g))
      assert.ok(api.acquisitionSources(g).every((s: any) => !/inventory-grant|import/.test(s.key)))
    }
  assert.equal(total, 910)
  assert.equal(protectedCount, 0, 'today’s real catalogue is repeatable; synthetic cases must stay test-only')
  assert.equal(api.availability({ id: 'future-unobtainable' }), 'discontinued')
})

test('rare and discontinued daily goods require confirmation before stock, effects, timing or task progress', async () => {
  for (const kind of ['rare', 'discontinued'] as const) {
    for (const [type,id] of [['food','102010001'],['clean','10021008'],['toy','t0002'],['background','b0000001']]) {
      const { api, state, save, confirm } = await model({ [id]: kind })
      const g = api.goodOf(type,id)
      const before = JSON.stringify(save)
      api.useItem(g)
      const first = state.dialogs.at(-1)
      assert.match(first.msg(), new RegExp(kind === 'rare' ? '稀有' : '绝版'))
      assert.equal(JSON.stringify(save), before)
      assert.equal(state.pending.length, 0)
      first.onClose()
      confirm(first)
      assert.equal(JSON.stringify(save), before, 'cancelled or replaced confirmation is inert')
      api.useItem(g)
      confirm()
      const pending = state.pending.shift()!
      const stock = api.quantityOf(type,id)
      pending();pending();confirm()
      assert.equal(api.quantityOf(type,id),stock-1)
      assert.equal(state.counts, type === 'background' ? 0 : 1)
    }
  }
})

test('protected quantity use starts at one, uses live stock and confirms only the chosen amount once', async () => {
  const { api, state, save, info, confirm } = await model({ growth: 'rare' })
  save.selfGoodDatas.nums=['_growth*5']
  const g=api.goodOf('nums','growth'), before=info.growth
  api.useItem(g)
  const dialog=state.dialogs.at(-1)
  assert.equal(dialog.initial,1)
  assert.equal(dialog.max(),5)
  assert.match(dialog.msg(2),/消耗 2 份 \/ 背包 5 份/)
  confirm(dialog,2);confirm(dialog,2)
  assert.equal(api.quantityOf('nums','growth'),3)
  assert.equal(info.growth,before+2*g.value)
  api.useItem(g)
  const stale=state.dialogs.at(-1)
  api.takeGood(g,3)
  assert.equal(stale.max(),0)
  confirm(stale,2)
  assert.equal(info.growth,before+2*g.value)
})

test('confirmation rechecks health, pause, inventory and disk failure without consuming on cancellation', async () => {
  const id='102010001'
  const { api, state, save, info, confirm } = await model({ [id]: 'rare' })
  const g=api.goodOf('food',id)
  api.useItem(g);save.settings.paused=true;confirm()
  assert.equal(state.pending.length,0)
  save.settings.paused=false
  api.useItem(g);confirm()
  const pending=state.pending.shift()!
  api.takeGood(g,api.quantityOf('food',id));pending()
  assert.equal(state.counts,0)
  api.addGood('food',id,1)
  api.useItem(g);confirm()
  state.fail=true
  const failed=state.pending.shift()!,before=JSON.stringify(save)
  assert.throws(()=>failed(),/disk failure/)
  assert.equal(JSON.stringify(save),before)
  state.fail=false;failed()
  assert.equal(api.quantityOf('food',id),0)
  assert.equal(state.counts,1)
  info.health=0
  api.addGood('food',id,1)
  const dialogs=state.dialogs.length
  api.useItem(g)
  assert.equal(state.dialogs.length,dialogs)
})

test('medicine warnings retain living-pet revival and right/wrong cure timing; paid treatment leaves stock intact', async () => {
  const { api, state, save, info, confirm } = await model({ '60001':'rare','10001':'discontinued' })
  save.selfGoodDatas.medicine=['_60001*2','_10001*2']
  info.health=3
  api.useItem(api.goodOf('medicine','60001'))
  assert.match(state.dialogs.at(-1).msg(),/尚未死亡/)
  confirm()
  assert.equal(state.dialogs.length,1,'revival warning is integrated, never a second popup')
  assert.equal(info.health,5)
  assert.equal(api.quantityOf('medicine','60001'),1)
  const dialogs=state.dialogs.length
  api.useItem(api.goodOf('medicine','10001'))
  assert.equal(state.dialogs.length,dialogs,'healthy pet refuses unnecessary medicine before confirmation')
  info.health=3
  api.useItem(api.goodOf('medicine','10001'));confirm()
  assert.equal(info.health,3)
  state.pending.shift()!()
  assert.equal(info.health,5)
  assert.equal(api.quantityOf('medicine','10001'),1)
  info.health=3
  api.useItem(api.goodOf('medicine','10001'),true)
  state.pending.shift()!()
  assert.equal(api.quantityOf('medicine','10001'),1,'doctor-paid treatment skips inventory even when stock arrived meanwhile')
  info.health=3
  api.useItem(api.goodOf('medicine','60001'))
  const d=state.dialogs.at(-1);d.onClose();confirm(d)
  assert.equal(api.quantityOf('medicine','60001'),1)
})

test('doctor-owned medicine opens the protection after diagnosis, while wrong medicine waits until animation end', async () => {
  const { api, state, save, info, confirm } = await model({ '10001':'rare', '10002':'discontinued' })
  save.selfGoodDatas.medicine=['_10001*2','_10002*2']
  info.health=3
  save.activeOption.ill={id:'ill',start:0}
  // Read the actual doctor flow; activity() only needs a non-null illness id.
  api.doctor()
  confirm()
  assert.equal(state.dialogs.at(-1).title,'诊断结果')
  confirm()
  assert.equal(state.dialogs.at(-1).title,'物品使用确认')
  assert.equal(api.quantityOf('medicine','10001'),2)
  confirm();state.pending.shift()!()
  assert.equal(info.health,5)
  assert.equal(api.quantityOf('medicine','10001'),1)
  info.health=3
  api.useItem(api.goodOf('medicine','10002'));confirm()
  assert.equal(info.health,3)
  state.pending.shift()!()
  assert.equal(info.health,2)
  assert.equal(api.quantityOf('medicine','10002'),1)
})

test('automatic and configured care skip protected supplies without buying, prompting or changing saved preferences', async () => {
  const { api, state, save, info } = await model({ '102010001':'rare', t0002:'discontinued' })
  info.health=5;info.hunger=1;info.clean=save.petComputedlInfo.cleanMax;info.mood=1
  info.sweetHeart=true;info.sweetHeartOverTime=Date.now()/1000+10000
  save.selfGoodDatas.food=['_102010001*3'];save.selfGoodDatas.toy=['_t0002*3']
  save.settings.careFoodId='102010001';save.settings.careToyId='t0002';save.settings.careAutoBuy=true
  const before=JSON.stringify(save)
  for(let i=0;i<5;i++)assert.equal(api.selfCare(),false)
  assert.equal(api.useCareItem(api.goodOf('toy','t0002'),'care'),false)
  assert.equal(JSON.stringify(save),before)
  assert.equal(state.dialogs.length,0)
  save.settings.careFoodId='';save.settings.careAutoBuy=false
  api.addGood('food','102010003',1)
  assert.equal(api.selfCare(),true)
  assert.equal(api.quantityOf('food','102010001'),3)
  api.update('settings',structuredClone(save.settings))
  const imported=validatedImport(structuredClone(state.disk))
  assert.equal(imported.settings.careToyId,'t0002','old choices are preserved, not silently replaced')
})
