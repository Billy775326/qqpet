import { readFileSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

export async function prepareMenu() {
  const setup = `
    window.testSave={havePet:true,isBury:false,settings:{hidden:true,paused:false},petInfo:{lastX:100,lastY:100,health:5,growth:0,sex:'GG'}};
    window.nativeMenus=0;window.priority=[];window.callbacks={};
    window.qqpet={showTrayMenu(){nativeMenus++},setMenuOpen:on=>priority.push(on),onCursor:fn=>callbacks.cursor=fn,onTrayClick:fn=>callbacks.tray=fn,onClipboard(){},setClickThrough(){}};
  `
  const stub = `
    export const save=window.testSave,info=save.petInfo;
    export const stage=()=> 'Kid',mood=()=> 'peaceful',petSize=()=>100,onInfoChange=()=>{},setInfo=(k,v)=>info[k]=v;
    export const update=(group,patch)=>Object.assign(save[group],patch),setPaused=()=>{},setTray=()=>{},aiOn=()=>false;
    export const speak=(_s,_a,hooks)=>{hooks?.start?.();hooks?.end?.()},machine={play(){}},bury=()=>{};
    export const startPet=()=>{},resumeTask=()=>{},clipAsk=()=>{},adopt=()=>{},openChat=()=>{},openGoods=()=>{},openPetInfo=()=>{},openSetup=()=>{},openShop=()=>{},openState=()=>{},scheduleHide=()=>{},showControl=()=>{},collapseControls=()=>{};
    export const createEdgeMini=()=>({refresh(){},trackPointer(){},enter(){}});
  `
  const result = await build({ entryPoints: ['src/renderer/main.ts'], bundle: true, write: false, format: 'iife', plugins: [{ name: 'isolated-menu', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || ['./ui/menu', './ui/dom', './dom', './frame', './pet/geometry', '../../shared/pet-geometry'].includes(args.path)) return
      return { path: args.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
  } }] })
  const code = result.outputFiles[0].text + `
    window.fixture={open:(x,y)=>callbacks.tray({kind:'menu',x,y}),cursor:(x,y)=>callbacks.cursor({x,y}),hide:()=>{testSave.settings.hidden=true;document.body.classList.add('petHidden')},state:()=>({nativeMenus,priority,hidden:testSave.settings.hidden})};
  `
  const css = ['base.css', 'style.css', 'ui/css/menu.css', 'ui/css/frame.css'].map(p => readFileSync('src/renderer/' + p, 'utf8')).join('\n')
  writeFileSync('dist/ui-menu-prepared.json', JSON.stringify({ setup, code, css }))
}
