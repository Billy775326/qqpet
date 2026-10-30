import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'esbuild'

export async function prepareControls() {
  const source = readFileSync('src/renderer/ui/control.ts','utf8')
  const css = ['src/renderer/base.css','src/renderer/style.css','src/renderer/ui/css/control.css'].map(p=>readFileSync(p,'utf8')).join('\n')
  const setup = `
    window.info = {lastX:0,lastY:0,sex:'GG',hunger:500,clean:500,health:5,mood:500};
    window.save = {isBury:false,petComputedlInfo:{hungerMax:1000,cleanMax:1000,healthMax:5,moodMax:1000}};
    window.touch = false; window.fixtureSize = 146;
    window.petSize = () => fixtureSize; window.stage=()=> 'Kid';window.mood=()=> 'peaceful';
    window.setBubbleLift = n => {window.bubbleLift = n};
    window.onInfoChange = () => {}; window.onGoodsChange = () => {};
    window.img = (cls,url) => {const e=document.createElement('img');e.className=cls;e.src=url;return e};
    window.div = (cls,...children) => {const e=document.createElement('div');e.className=cls;e.append(...children);return e};
    window.button = (cls,fn,...children) => {const e=div(cls,...children);e.addEventListener('click',fn);return e};
    for(const name of ['describeStudy','describeWork','study','studyGoods','work','workGoods','doctor','pay','useItem','speak','openPinkDiamond','formatDate','openEmail','openFarm','openFishing','openGames','openMstx','openPetInfo','progress','openSetup','openShop','openSignIn','openTask','openTravel','windowView']) window[name]=()=>{};
    window.describe = () => ['测试物品详细说明'];
    window.listGoods = () => ({list:[{name:'测试物品',num:1,url:''}],totalPage:1});
    window.pageOf = () => ({list:[],totalPage:1});

  `
  const bundled=await build({stdin:{contents:source+"\n    window.fixture = {\n      position(x,y){info.lastX=x;info.lastY=y;clearTimeout(hideTimer);clearTimeout(introTimer);shown=true;control.classList.add('showControl');place()},\n      panel(){PANELS.food()},closePanel(){closePanel();clearTimeout(hideTimer)},reflow:place,\n      state(){\n        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};\n        return {layout:control.dataset.layout,placement:control.dataset.placement,items:[...menus.children].map(rect),body:petVisibleRect(),action:petCanvasRect(),above:control.classList.contains('abovePet'),row:rect(menus),icons:[...menus.querySelectorAll('.menuItemIconBox')].map(rect),children:[...menus.querySelectorAll('.childrenMenu')].map(e=>({...rect(e),direction:e.dataset.direction,rows:[...e.children].map(rect)})),panel:control.querySelector('.goodList')&&rect(control.querySelector('.goodList')),tips:[...control.querySelectorAll('.goodInfo')].filter(e=>getComputedStyle(e).display!=='none').map(rect)}\n      }\n    };",resolveDir:resolve('src/renderer/ui'),loader:'ts'},bundle:true,write:false,format:'iife',plugins:[{name:'isolated-control-runtime',setup(b){
    b.onResolve({filter:/.*/},args=>{
      if(['../pet/geometry','../../shared/pet-geometry','./dom'].includes(args.path))return
      return {path:args.path,namespace:'mock'}
    })
    b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:"export const info=globalThis.info,save=globalThis.save;\nexport const petSize=()=>globalThis.fixtureSize,stage=()=> 'Kid',mood=()=> 'peaceful';\nexport const onInfoChange=()=>{},onGoodsChange=()=>{},setBubbleLift=globalThis.setBubbleLift;\nexport const describe=globalThis.describe,listGoods=globalThis.listGoods,pageOf=globalThis.pageOf;\nexport const expandEdgeMini=()=>false;\nexport const describeStudy=globalThis.describeStudy;\nexport const describeWork=globalThis.describeWork;\nexport const study=globalThis.study;\nexport const studyGoods=globalThis.studyGoods;\nexport const work=globalThis.work;\nexport const workGoods=globalThis.workGoods;\nexport const doctor=globalThis.doctor;\nexport const pay=globalThis.pay;\nexport const useItem=globalThis.useItem;\nexport const speak=globalThis.speak;\nexport const openPinkDiamond=globalThis.openPinkDiamond;\nexport const formatDate=globalThis.formatDate;\nexport const openEmail=globalThis.openEmail;\nexport const openFarm=globalThis.openFarm;\nexport const openFishing=globalThis.openFishing;\nexport const openGames=globalThis.openGames;\nexport const openMstx=globalThis.openMstx;\nexport const openPetInfo=globalThis.openPetInfo;\nexport const progress=globalThis.progress;\nexport const openSetup=globalThis.openSetup;\nexport const openShop=globalThis.openShop;\nexport const openSignIn=globalThis.openSignIn;\nexport const openTask=globalThis.openTask;\nexport const openTravel=globalThis.openTravel;\nexport const windowView=globalThis.windowView;\n"}))
  }}]})
  writeFileSync('dist/ui-controls-prepared.json',JSON.stringify({setup,code:bundled.outputFiles[0].text,css}))
}
