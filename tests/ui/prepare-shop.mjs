import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareShop() {
  const entry = `
    import {openShop} from './shop';
    import {windowView} from './window-view';
    import {openSetup} from './setup';
    import {info,setInfo,save} from '../pet/store';
    const timers=new Set(),nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window),nativeNow=Date.now.bind(Date);
    window.setInterval=(fn,...args)=>{const id=nativeSetInterval(fn,...args);timers.add(id);return id};
    window.clearInterval=id=>{timers.delete(id);nativeClearInterval(id)};
    Date.now=()=>window.fixtureNow??nativeNow();
    window.fixture={openShop,openSetup,
      timerCount:()=>timers.size,clock:ms=>{window.fixtureNow=ms},advance:seconds=>{window.fixtureNow+=seconds*1000},
      setMembership:patch=>Object.entries(patch).forEach(([key,value])=>setInfo(key,value)),
      openQuantity:(max,sweet)=>windowView({max,sweet,msg:'托管费用：300元宝/一天',ok:(close,num)=>{window.quantitySubmitted=num;close()}}),
      closeShop:()=>document.querySelector('.ui-shop .close')?.click(),
      closeSetup:()=>document.querySelector('.ui-setup .close')?.click(),
      balance:()=>info.yb,setBalance:yb=>setInfo('yb',yb),
      settings:()=>({...save.settings}),
      setBackground:background=>{save.selfGoodUseOption.background=background},
      retainSubmit:()=>window.staleSubmit=document.querySelector('.localRecharge .windowViewButSubmit')};
  `
  const stub = `
    export const speak=speech=>{window.lastSpeech=speech.s},readopt=()=>{},setHidden=()=>{},setFaceClick=()=>{},weatherNow=async()=>'';
    export const goodOf=(type,id)=>({type,id,name:'测试商品',num:1,price:12,url:'pet/img_res/food/102010001.gif'});
    export {durationText} from '../pet/data/goods.ts';
    export const TYPE_NAMES={food:'食物',clean:'日用品',medicine:'药品',toy:'玩具',nums:'属性',background:'背景'};
    import {save} from '../pet/store';
    export const listGoods=(type,page,size)=>({list:save.selfGoodDatas[type].slice((page-1)*size,page*size).map(g=>({...goodOf(type,g.id),num:g.num})),totalPage:Math.max(1,Math.ceil(save.selfGoodDatas[type].length/size))}),describe=()=>['隔离商品'],onGoodsChange=()=>{};
    export const price=g=>g.price,buy=()=>true,useItem=()=>{};
    export const expandEdgeMini=()=>false;
    export const openInventoryGrant=()=>{};
  `
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' },
    bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'isolated-shop-source', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (['./shop', './setup', '../pet/store', './box', './dom', '../ui/dom', './date', './recharge', '../../shared/recharge', '../pet/data/shop.json', '../pet/data/goods.ts', './goods.json', '../../../package.json', './level', './window-view'].includes(args.path)) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub, resolveDir: resolve('src/renderer/ui') }))
    } }],
  })
  const css = ['base.css', 'style.css', 'ui/css/shop.css', 'ui/css/setup.css', 'ui/css/window.css', 'ui/css/recharge.css'].map(p => readFileSync('src/renderer/' + p, 'utf8')).join('\n')
  writeFileSync('dist/ui-shop-prepared.json', JSON.stringify({ code: result.outputFiles[0].text, css }))
}
