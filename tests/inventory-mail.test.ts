import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

let serial = 0
async function model(seed = startSave(null)) {
  seed.havePet = true
  const state = { disk: structuredClone(seed), writes: 0, attempts: 0, fail: false, counters: 0, dialogs: [] as any[], pending: [] as (() => void)[], changes: [] as string[][] }
  const bridge = { qqpet: {
    load: async () => structuredClone(state.disk),
    save: (patch: any) => {
      state.attempts++
      if (state.fail) throw new Error('Simulated disk failure')
      const next = structuredClone(state.disk)
      applyPatch(next, patch)
      state.disk = next
      state.writes++
      state.changes.push(Object.keys(patch))
    },
  } }
  const stub = `const s=window.fixture;
    export const touch=false,isBuddy=()=>false;
    export const speak=(_line,_action,hooks={})=>{if(hooks.start)s.pending.push(hooks.start);if(hooks.end)s.pending.push(hooks.end)};
    export const windowView=dialog=>s.dialogs.push(dialog),floatMood=()=>{},addCount=()=>s.counters++,rand=min=>min;
    export const DEAD={cure:{id:'60001'}},illOf=()=>({cure:{id:'10001'},successTolk:'healed',errTolk:'wrong'});`
  const result = await build({
    stdin: { contents: "export * from './mail';export * from './goods';export * from './items';export {save,info} from './store';export * from './data/goods'", loader: 'ts', resolveDir: resolve('src/renderer/pet') },
    bundle: true, write: false, format: 'esm', plugins: [{ name: 'mail-model', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) || ['./acquisition','../pet/acquisition','./data/task-definitions','./milestones','../../shared/save-logic'].includes(args.path) || ['./mail','./goods','./items','./store','./inventory','./data/goods','./level'].includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  ;(globalThis as any).__inventoryFixture = { ...bridge, fixture: state }
  const code = 'const window=globalThis.__inventoryFixture;\n' + result.outputFiles[0].text + `\n// fixture ${serial++}`
  const api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  delete (globalThis as any).__inventoryFixture
  // Exclude the store's existing load-time position/level normalization writes.
  state.writes=state.attempts=0
  state.changes=[]
  return { api, state, save: api.save, info: api.info }
}
const snapshot = (value: unknown) => JSON.stringify(value)

test('full catalogue is sent as compatible attachments in one write without touching inventory', async () => {
  const { api, state, save } = await model()
  const before = snapshot({ inventory: save.selfGoodDatas, seen: save.illustrated })
  assert.deepEqual(api.mailInventoryGrant(), { created: true, count: 888 })
  assert.equal(state.writes, 1)
  assert.deepEqual(state.changes, [['saveJsonData']])
  assert.equal(snapshot({ inventory: save.selfGoodDatas, seen: save.illustrated }), before)
  const mails = api.readMails()
  const mail: any = Object.values(mails)[0]
  assert.equal(mail.l, '全物品领取')
  assert.equal(mail.glb.length, 888)
  assert.equal(new Set(mail.glb.map((g: any) => g.id)).size, 888)
  assert.ok(mail.glb.every((g: any) => ['food','clean','medicine','toy'].includes(g.type) && g.num === 1))
  assert.equal(mail.glb.filter((g: any) => g.type === 'toy').length, 27)
  assert.ok(Buffer.byteLength(snapshot(state.disk)) < 10*1024*1024)
  assert.deepEqual(api.mailInventoryGrant(), { created: false, count: 888 })
  assert.equal(state.writes, 1)
  const id=Object.keys(mails)[0]
  api.claimMails([id])
  assert.deepEqual(api.mailInventoryGrant(),{created:true,count:888},'a deliberate new request is allowed after claiming the previous grant')
  assert.equal(Object.values(api.readMails()).filter((m:any)=>!m.e&&!m.r&&m.k===api.INVENTORY_GRANT_KEY).length,1)
})

test('mail creation and claiming preserve old blobs, unknown inventory, duplicate stock and legacy wrapper imports', async () => {
  const seed = startSave(null)
  seed.selfGoodDatas.food = ['_future-food*7','_102010001*2','_102010001*3']
  seed.selfGoodDatas.toy = ['_t0002*4','_future-toy*6']
  seed.illustrated = ['future-food', { legacy: 'keep' }]
  seed.saveJsonData.email = JSON.stringify({ '1': { d: 1, e: true, k: 'welcome' }, '2': { d: 2, l: '旧信', glb: [], p: 'old-photo' } })
  seed.saveJsonData.custom = '{"keep":true}'
  const { api, state, save } = await model(seed)
  api.mailInventoryGrant()
  const restored = await model(validatedImport({ petInfoData: structuredClone(state.disk) }))
  const mails = restored.api.readMails()
  const id = Object.keys(mails).find(key => mails[key].k === api.INVENTORY_GRANT_KEY)!
  assert.equal(restored.api.claimMails([id,id]).length, 1)
  assert.equal(restored.state.writes, 1)
  assert.deepEqual(restored.state.changes, [['selfGoodDatas','illustrated','saveJsonData']])
  assert.equal(restored.api.quantityOf('food','102010001'), 6)
  assert.equal(restored.api.quantityOf('toy','t0002'), 5)
  assert.ok(restored.save.selfGoodDatas.food.includes('_future-food*7'))
  assert.ok(restored.save.selfGoodDatas.toy.includes('_future-toy*6'))
  assert.equal(restored.save.illustrated.filter((id: unknown) => id === '102010001').length, 1)
  assert.deepEqual(restored.save.illustrated[1], { legacy: 'keep' })
  assert.equal(restored.save.saveJsonData.custom, seed.saveJsonData.custom)
  assert.deepEqual(restored.api.readMails()['1'], {d:1,e:true,k:'welcome'})
  assert.deepEqual(restored.api.readMails()['2'], {d:2,l:'旧信',glb:[],p:'old-photo'})
  for (const g of api.inventoryGrantGoods()) assert.ok(restored.api.quantityOf(g.type,g.id) >= 1)
  const again = await model(validatedImport(structuredClone(restored.state.disk)))
  assert.deepEqual(again.api.claimMails([id]), [])
  assert.equal(again.state.writes, 0)
  assert.equal(snapshot(save.selfGoodDatas), snapshot(seed.selfGoodDatas),'sending never changes preexisting inventory')
})

test('invalid, insufficient and stale deductions never partially consume or write', async () => {
  const { api, state, save } = await model()
  save.selfGoodDatas.toy = ['_t0002*2','_future-toy*3','_t0002*3']
  const g = api.goodOf('toy','t0002',999)
  const before = snapshot(save)
  for (const n of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,6,999]) assert.equal(api.takeGood(g,n), false)
  assert.equal(snapshot(save), before)
  assert.equal(state.writes, 0)
  assert.equal(api.takeGood(g,4), true)
  assert.deepEqual(save.selfGoodDatas.toy, ['_t0002*1','_future-toy*3'])
  assert.equal(api.takeGood(g,2), false)
  assert.equal(api.takeGood(g,1), true)
  assert.equal(api.takeGood(g,1), false)
  assert.equal(state.writes, 2)
})

test('manual quantity dialogs and delayed play recheck live stock before applying effects', async () => {
  const { api, state, save, info } = await model()
  save.selfGoodDatas.nums = ['_growth*3']
  const g = api.goodOf('nums','growth',3)
  api.useItem(g)
  const dialog = state.dialogs.at(-1)
  assert.equal(dialog.max(),3)
  assert.equal(api.takeGood(g,2),true)
  assert.equal(dialog.max(),1)
  const growth = info.growth
  dialog.ok(()=>{},3)
  assert.equal(info.growth,growth)
  assert.equal(api.quantityOf('nums','growth'),1)
  save.selfGoodDatas.toy=['_t0009*1']
  info.mood=100
  api.useItem(api.goodOf('toy','t0009'))
  assert.equal(api.useCareItem(api.goodOf('toy','t0009'),'care'),true)
  const mood=info.mood
  state.pending.shift()!()
  assert.equal(info.mood,mood)
  assert.equal(state.counters,1,'the stale manual animation grants no second effect or task progress')
})

test('disk failures leave the renderer, inventory, seen IDs and email status unchanged and retries commit once', async () => {
  const { api, state, save } = await model()
  state.fail=true
  const before=snapshot(save),disk=snapshot(state.disk)
  assert.throws(()=>api.mailInventoryGrant(),/disk failure/)
  assert.equal(snapshot(save),before)
  assert.equal(snapshot(state.disk),disk)
  state.fail=false
  api.mailInventoryGrant()
  const id=Object.keys(api.readMails())[0]
  const pending=snapshot(save),pendingDisk=snapshot(state.disk)
  let notices=0
  const unsubscribe=api.onMailChange(()=>notices++)
  state.fail=true
  assert.throws(()=>api.claimMails([id]),/disk failure/)
  assert.equal(snapshot(save),pending)
  assert.equal(snapshot(state.disk),pendingDisk)
  assert.equal(notices,0)
  state.fail=false
  assert.equal(api.claimMails([id]).length,1)
  assert.equal(state.writes,2,'one mail write plus one atomic attachment claim')
  assert.equal(notices,1)
  assert.equal(api.claimMails([id]).length,0)
  unsubscribe()
})

test('failed inventory removal leaves its quantity unchanged; overflow rejects the whole mail batch', async () => {
  const { api, state, save } = await model()
  const g=api.goodOf('toy','t0002')
  const before=snapshot(save.selfGoodDatas)
  state.fail=true
  assert.throws(()=>api.takeGood(g),/disk failure/)
  assert.equal(snapshot(save.selfGoodDatas),before)
  state.fail=false
  api.mailInventoryGrant()
  const id=Object.keys(api.readMails())[0]
  save.selfGoodDatas.food=['_102010001*'+Number.MAX_SAFE_INTEGER]
  const full=snapshot(save), writes=state.writes
  assert.throws(()=>api.claimMails([id]),/数量超出/)
  assert.equal(snapshot(save),full)
  assert.equal(state.writes,writes)
  assert.equal(api.readMails()[id].r,undefined)
})

test('claim-all includes legacy goods and photo mail, ignores deleted or previously claimed mail and preserves tombstones', async () => {
  const seed=startSave(null)
  seed.saveJsonData.email=JSON.stringify({
    '1':{d:1,l:'旧奖励',glb:[{id:'t0002',type:'toy',name:'棒球',num:2,url:'pet/img_res/toy/t0002.png'},{id:'yb',type:'nums',name:'元宝',num:100,url:'pet/img_res/muns/l1.gif'}],k:'birthday-2025'},
    '2':{d:2,l:'照片',glb:[],p:'photo'},
    '3':{d:3,l:'已领取',glb:[],r:true,k:'holiday'},
    '4':{d:4,e:true,k:'welcome'},
  })
  const {api,state}=await model(seed)
  const balance=api.info.yb,coins=api.quantityOf('nums','yb')
  api.deleteMails(['1','2'])
  assert.equal(state.writes,0,'unclaimed attachments cannot be deleted')
  assert.equal(api.claimMails(['1','2','3','4','missing']).length,2)
  assert.equal(state.writes,1)
  assert.equal(api.quantityOf('toy','t0002'),3)
  assert.equal(api.quantityOf('nums','yb'),coins+100,'legacy currency attachments still enter the inventory')
  assert.equal(api.info.yb,balance,'claiming a currency item does not immediately spend or activate it')
  api.deleteMails(['1','2','3','4'])
  assert.equal(state.writes,2)
  assert.deepEqual(api.readMails()['1'],{d:1,e:true,k:'birthday-2025'})
  assert.deepEqual(api.readMails()['4'],{d:4,e:true,k:'welcome'})
  api.deliverMails()
  assert.equal(Object.values(api.readMails()).some((m:any)=>m.k==='welcome'&&!m.e),false,'deleting the old welcome cannot cause another welcome reward')
})
