import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'esbuild'
export async function prepareMini(){
  const source=readFileSync('src/renderer/main.ts','utf8')
  const setup=`
    window.phase='Kid';window.feeling='peaceful';window.testBusy=false;
    const div=(cls,...children)=>{const e=document.createElement('div');e.className=cls;e.append(...children);return e};
    const img=(cls,src)=>Object.assign(document.createElement('img'),{className:cls,src});
    const button=(cls,run,...children)=>{const e=div(cls,...children);e.addEventListener('click',run);return e};

    const capturedTimers=window.capturedTimers=new Map();const originalSet=window.setTimeout.bind(window),originalClear=window.clearTimeout.bind(window);let timerId=1000000;
    window.setTimeout=(fn,ms,...args)=>{if(ms===180000){const id=timerId++;capturedTimers.set(id,()=>fn(...args));return id}return originalSet(fn,ms,...args)};
    window.clearTimeout=id=>{if(!capturedTimers.delete(id))originalClear(id)};

    window.testSave={havePet:true,isBury:false,petInfo:{lastX:250,lastY:200,sex:'GG',hunger:500,clean:500,health:5,mood:500,growth:0,yb:5000},settings:{hidden:false,opacity:1},petComputedlInfo:{level:1,hungerMax:1000,cleanMax:1000,healthMax:5,moodMax:1000}};
    window.qqpet={setClickThrough(){},onCursor(fn){this.testCursor=fn},onTrayClick(){},onClipboard(){}};`
  const api=`    const miniWidget = document.querySelector('.local-edge-mini');
    window.fixture={
      full:()=>mini.expand(),mini:()=>mini.enter(),state:()=>({model:structuredClone(info),mini:mini.active,mode:miniWidget.dataset.mode,hidden:miniWidget.hidden,dragging:miniWidget.classList.contains('local-mini-dragging'),sleepTimers:window.capturedTimers.size,phase,sex:info.sex,x:info.lastX,y:info.lastY,pref:localStorage.getItem('qqpet.edge-mini.v1'),controls:document.querySelector('.control').classList.contains('showControl')}),
      position(x,y){mini.expand();setInfo('lastX',x);setInfo('lastY',y);layout()},
      grab(){const r=petEl.getBoundingClientRect(),m=petMetrics();return {x:r.left+(m.left+m.right)/2,y:r.top+(m.top+m.bottom)/2}},
      target(side){const m=petMetrics(),dx=(m.left+m.right)/2,dy=(m.top+m.bottom)/2;return {x:side==='right'?innerWidth-m.right-5+dx:side==='left'?5-m.left+dx:innerWidth/2,y:side==='top'?5-m.top+dy:side==='bottom'?innerHeight-m.bottom-5+dy:innerHeight/2}},
      cursor:p=>window.qqpet.testCursor(p),
      sleep(){for(const [id,fn] of [...window.capturedTimers]){window.capturedTimers.delete(id);fn()}},
      busy(on){testBusy=on;window.dispatchEvent(new Event('qqpet:pose'))},
      hide(on){save.settings.hidden=on;document.body.classList.toggle('petHidden',on)},
      health:v=>{setInfo('health',v);window.dispatchEvent(new Event('qqpet:pose'))},
      avatar(sex,next){phase=next;setInfo('sex',sex);mini.refresh()},
      externalPanel(on){if(on){const e=div('boxFrame');e.id='externalPanel';document.body.append(e)}else document.getElementById('externalPanel')?.remove()},
      goods:()=>showControl(),refresh:mini.refresh,cleanup:()=>mini.destroy(),
    };`
  const stub=`export const save=globalThis.testSave, info=save.petInfo;
const listeners=[];
export const onInfoChange=fn=>listeners.push(fn);
export const setInfo=(key,value)=>{if(info[key]===value)return;info[key]=value;for(const fn of listeners)fn(key)};
export const petSize=()=>146,stage=()=>globalThis.phase,mood=()=>globalThis.feeling,busy=()=>globalThis.testBusy;
export const openMenu=()=>{window.menuOpened=true};
export const describe=()=>[],listGoods=()=>({list:[],totalPage:1}),pageOf=()=>({list:[],totalPage:1});
export const setBubbleLift=()=>{};
export const onGoodsChange=()=>{};
export const adopt=()=>{};
export const closeMenu=()=>{};
export const trackMenuPointer=()=>{};
export const runTrayAction=()=>{};
export const startPet=()=>{};
export const resumeTask=()=>{};
export const clipAsk=()=>{};
export const openState=()=>{};
export const describeStudy=()=>{};
export const describeWork=()=>{};
export const study=()=>{};
export const studyGoods=()=>{};
export const work=()=>{};
export const workGoods=()=>{};
export const doctor=()=>{};
export const pay=()=>{};
export const useItem=()=>{};
export const speak=()=>{};
export const openPinkDiamond=()=>{};
export const formatDate=()=>{};
export const openEmail=()=>{};
export const openFarm=()=>{};
export const openFishing=()=>{};
export const openGames=()=>{};
export const openMstx=()=>{};
export const openPetInfo=()=>{};
export const progress=()=>{};
export const openSetup=()=>{};
export const openShop=()=>{};
export const openSignIn=()=>{};
export const openTask=()=>{};
export const openTravel=()=>{};
export const windowView=()=>{};
`
  const result=await build({stdin:{contents:source+'\n'+api,resolveDir:resolve('src/renderer'),loader:'ts'},bundle:true,write:false,format:'iife',plugins:[{name:'isolated-mini-source',setup(b){
    b.onResolve({filter:/.*/},args=>{
      if(['./pet/geometry','../pet/geometry','../../shared/pet-geometry','./ui/control','./ui/dom','./dom','./ui/edge-mini','./edge-mini'].includes(args.path))return
      return {path:args.path,namespace:'mock'}
    })
    b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:stub}))
  }}]})
  const css=['base.css','style.css','ui/css/control.css','ui/css/edge-mini.css'].map(p=>readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-mini-prepared.json',JSON.stringify({setup,code:result.outputFiles[0].text,css}))
}
