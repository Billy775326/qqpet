import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareSweetHeart() {
  const entry = `
    import {openSweetHeartPurchase} from './sweetheart';
    import {openState} from './state';
    import {openPinkDiamondPurchase} from './pink-diamond';
    import {openPetInfo} from './petinfo';
    import {progress} from './progress';
    import {info,setInfo,save} from '../pet/store';
    import {addSweetHeart,dayStart} from '../pet/vip';
    import {sweetHeartCapacity} from '../../shared/sweetheart';
    const timers=new Set(),nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
    window.setInterval=(fn,delay,...args)=>{const id=nativeSetInterval(fn,delay,...args);timers.add(id);return id};
    window.clearInterval=id=>{timers.delete(id);nativeClearInterval(id)};
    window.fixtureNow=Date.now();
    Date.now=()=>window.fixtureNow;
    window.fixture={
      open:openSweetHeartPurchase,openState,openPink:openPinkDiamondPurchase,openPetInfo,progress,addSweetHeart,timerCount:()=>timers.size,
      reset:(expires,balance=100000,on=true)=>{setInfo('sweetHeartOverTime',expires);setInfo('yb',balance);setInfo('sweetHeart',on)},
      resetPink:(patch)=>Object.entries(patch).forEach(([k,v])=>setInfo(k,v)),
      pinkState:()=>({expires:info.PDiamondExpirationDate,began:info.PDiamondBeginDate,balance:info.yb,growth:info.PDgrowth,active:info.pinkDiamond,fishResets:window.fishResets||0}),
      state:()=>({expires:info.sweetHeartOverTime,balance:info.yb,on:info.sweetHeart}),
      careState:()=>({...save.settings}),
      now:()=>Date.now()/1000,advance:seconds=>{window.fixtureNow+=seconds*1000},
      base:()=>dayStart(),capacity:()=>sweetHeartCapacity(info.sweetHeartOverTime),
    };
  `
  const stub = `
    export const resetFish=()=>{window.fishResets=(window.fishResets||0)+1},diploma=()=>null,speak=speech=>{window.lastSpeech=speech.s};
    export const elapsed=()=>0,stopTask=()=>null,openGoods=()=>{},openPetInfo=()=>{};
    export const goodOf=()=>({name:'测试商品',url:''}),durationText=()=>'';
    export const floatMood=async()=>{},DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}});
    export const addGood=()=>{},hasGood=()=>false,startTimed=()=>{},takeGood=()=>false,addCount=()=>{};
  `
  const allowed = ['./pink-diamond','../../shared/pink-diamond','./petinfo','./sweetheart','./state','../pet/store','./store','../pet/vip','../pet/items','../../shared/sweetheart','./box','./dom','../ui/dom','./window-view','../ui/window-view','./frame','./progress','./date','./level','./care-settings','../pet/care','./data/goods','../pet/data/goods','./goods','./inventory','./items']
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' },
    bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'isolated-sweetheart', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) || ['./acquisition','../pet/acquisition','./data/task-definitions','./milestones','../../shared/save-logic'].includes(args.path) || allowed.includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const css = ['base.css','style.css','ui/css/window.css','ui/css/state.css','ui/css/frame.css','ui/css/progress.css','ui/css/petinfo.css','ui/css/care-settings.css'].map(p=>readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-sweetheart-prepared.json',JSON.stringify({code:result.outputFiles[0].text,css}))
}
