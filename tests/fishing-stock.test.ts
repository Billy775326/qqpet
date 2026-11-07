import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'

let serial=0
async function model(seed=startSave(null)) {
  seed.havePet=true
  const state={disk:structuredClone(seed),writes:0,fail:false,time:1800000000,patches:[] as string[][]}
  const fixture={state,qqpet:{
    load:async()=>structuredClone(state.disk),
    save:(patch:any)=>{if(state.fail)throw Error('Simulated disk failure');const next=structuredClone(state.disk);applyPatch(next,patch);state.disk=next;state.writes++;state.patches.push(Object.keys(patch))},
  }}
  const built=await build({stdin:{contents:"export * from './fishing';export {save,info,setInfo,onInfoChange} from './store';",resolveDir:resolve('src/renderer/pet'),loader:'ts'},bundle:true,write:false,format:'esm',plugins:[{name:'isolated-pond',setup(b){
    b.onResolve({filter:/.*/},args=>{if(!args.importer|| ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) ||['./fishing','./store','./level','./data/goods'].includes(args.path)||args.path.endsWith('.json'))return;return{path:args.path,namespace:'mock'}})
    b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const windowView=()=>{},touch=false;'}))
  }}]})
  ;(globalThis as any).__pondFixture=fixture
  const prefix='const window=globalThis.__pondFixture;const Date={now:()=>window.state.time*1000};\n'
  const api=await import('data:text/javascript;base64,'+Buffer.from(prefix+built.outputFiles[0].text+'\n//'+serial++).toString('base64'))
  delete (globalThis as any).__pondFixture
  state.writes=0;state.patches=[]
  return {api,state,save:api.save,info:api.info}
}
const stock=(api:any,count?:unknown,fryid=2,paytype=1)=>api.pondCommand(4,{fryid,paytype,count})
const fishes=(save:any)=>JSON.parse(save.saveJsonData.fishs).fishs

test('ordinary and VIP stocking fill three/five positions in one commit with independent IDs and real growth timestamps',async()=>{
  for(const vip of [false,true]){
    const seed=startSave(null);seed.petInfo.pinkDiamond=vip
    const {api,state,save,info}=await model(seed)
    const capacity=vip?5:3,balance=info.yb
    assert.equal(api.pondStockQuote(2).max,capacity)
    let notices=0
    api.onInfoChange((key:string,previous:number)=>{if(key==='yb'){notices++;assert.equal(previous,balance)}})
    assert.equal(stock(api,capacity).result,0)
    assert.equal(state.writes,1)
    assert.deepEqual(state.patches,[['petInfo','saveJsonData']])
    const fish=fishes(save)
    assert.equal(fish.length,capacity)
    assert.equal(new Set(fish.map((f:any)=>f.id)).size,capacity)
    assert.ok(fish.every((f:any)=>f.born===state.time&&f.quantity===5&&f.basequantity===5&&f.stage===1))
    assert.equal(info.yb,balance-capacity*2)
    assert.equal(notices,1,'other open balance displays are notified')
    assert.equal(api.pondStockQuote(2).max,0)
    assert.notEqual(stock(api,1).result,0)
    assert.equal(state.writes,1)
  }
})

test('legacy single purchases remain valid and rapid replanting never reuses a live or removed fish ID',async()=>{
  const {api,state,save}=await model()
  assert.equal(stock(api).result,0)
  const first=fishes(save)[0].id
  assert.equal(stock(api).result,0)
  const second=fishes(save)[1].id
  assert.notEqual(first,second)
  api.pondCommand(5,{id:first})
  assert.equal(stock(api,2).result,0)
  const fish=fishes(save)
  assert.equal(fish.length,3)
  assert.ok(fish.every((f:any)=>f.id!==first&&f.born===state.time))
  assert.equal(new Set(fish.map((f:any)=>f.id)).size,3)
  api.pondCommand(2,{id:fish[1].id})
  const fed=fishes(save)
  assert.deepEqual(fed.map((f:any)=>f.siLiao),[0,1,0],'each batch member is independently addressable')
})

test('quantity, funds, level, membership and currency checks reject the whole request without saving',async()=>{
  const {api,state,save,info}=await model()
  info.yb=5
  assert.equal(api.pondStockQuote(2).max,2)
  const snapshot=JSON.stringify(save)
  for(const n of [0,-1,1.5,NaN,Infinity,null,3,Number.MAX_SAFE_INTEGER+1])assert.notEqual(stock(api,n).result,0)
  assert.notEqual(stock(api,1,999).result,0)
  assert.notEqual(stock(api,1,3).result,0,'level-six fry stay locked')
  assert.notEqual(stock(api,1,2,2).result,0,'QB cannot bypass the currency policy')
  assert.equal(JSON.stringify(save),snapshot)
  assert.equal(state.writes,0)
  assert.equal(stock(api,2).result,0)
  assert.equal(info.yb,1)
  const seed=startSave(null);seed.petInfo.growth=1000000
  const locked=await model(seed)
  assert.match(locked.api.pondStockQuote(5).reason,/粉钻/)
  assert.notEqual(stock(locked.api,1,5).result,0)
})

test('save failure preserves money, all fish and ID allocation; a retry commits the whole batch once',async()=>{
  const {api,state,save}=await model()
  const before=JSON.stringify(save),disk=JSON.stringify(state.disk)
  state.fail=true
  assert.throws(()=>stock(api,3),/disk failure/)
  assert.equal(JSON.stringify(save),before)
  assert.equal(JSON.stringify(state.disk),disk)
  assert.equal(state.writes,0)
  state.fail=false
  assert.equal(stock(api,3).result,0)
  assert.equal(state.writes,1)
  assert.deepEqual(fishes(save).map((f:any)=>f.id),[state.time,state.time+1,state.time+2])
})

test('existing pond data survives import; batch members keep normal feeding, growing and harvest behavior',async()=>{
  const {api,state,save,info}=await model()
  stock(api,2)
  const first=fishes(save)[0]
  const roundTrip=validatedImport({petInfoData:structuredClone(state.disk)})
  const restored=await model(roundTrip)
  assert.deepEqual(fishes(restored.save),fishes(save))
  assert.equal(restored.api.pondStockQuote(2).max,1)
  restored.state.time+=first.interval*2
  assert.equal(restored.api.ripeFish(),2)
  const balance=restored.info.yb
  assert.equal(restored.api.pondCommand(5,{id:first.id}).result,0)
  assert.equal(restored.info.yb,balance+10)
  assert.equal(restored.save.gameSaveDatas.fishing_harvestfish,1)
  assert.equal(fishes(restored.save).length,1)
  assert.equal(info.yb,4996,'isolated imported instance does not mutate the original')
})
