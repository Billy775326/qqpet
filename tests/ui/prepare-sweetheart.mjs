import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareSweetHeart() {
  const entry = `
    import {openSweetHeartPurchase} from './sweetheart';
    import {openState} from './state';
    import {info,setInfo} from '../pet/store';
    import {addSweetHeart,dayStart} from '../pet/vip';
    import {sweetHeartCapacity} from '../../shared/sweetheart';
    const timers=new Set(),nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
    window.setInterval=(fn,delay,...args)=>{const id=nativeSetInterval(fn,delay,...args);timers.add(id);return id};
    window.clearInterval=id=>{timers.delete(id);nativeClearInterval(id)};
    window.fixtureNow=Date.now();
    Date.now=()=>window.fixtureNow;
    window.fixture={
      open:openSweetHeartPurchase,openState,addSweetHeart,timerCount:()=>timers.size,
      reset:(expires,balance=100000,on=true)=>{setInfo('sweetHeartOverTime',expires);setInfo('yb',balance);setInfo('sweetHeart',on)},
      state:()=>({expires:info.sweetHeartOverTime,balance:info.yb,on:info.sweetHeart}),
      now:()=>Date.now()/1000,advance:seconds=>{window.fixtureNow+=seconds*1000},
      base:()=>dayStart(),capacity:()=>sweetHeartCapacity(info.sweetHeartOverTime),
    };
  `
  const stub = `
    export const resetFish=()=>{},speak=speech=>{window.lastSpeech=speech.s};
    export const elapsed=()=>0,stopTask=()=>null,openGoods=()=>{},openPetInfo=()=>{};
    export const goodOf=()=>({name:'测试商品',url:''}),durationText=()=>'';
    export const floatMood=async()=>{},DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}});
    export const addGood=()=>{},hasGood=()=>false,startTimed=()=>{},takeGood=()=>false,addCount=()=>{};
  `
  const allowed = ['./sweetheart','./state','../pet/store','./store','../pet/vip','../pet/items','../../shared/sweetheart','./box','./dom','../ui/dom','./window-view','../ui/window-view','./frame','./progress','./date','./level']
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' },
    bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'isolated-sweetheart', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || allowed.includes(args.path)) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const css = ['base.css','style.css','ui/css/window.css','ui/css/state.css','ui/css/frame.css','ui/css/progress.css'].map(p=>readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-sweetheart-prepared.json',JSON.stringify({code:result.outputFiles[0].text,css}))
}
