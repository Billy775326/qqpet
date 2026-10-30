import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareShop() {
  const entry = `
    import {openShop} from './shop';
    import {openSetup} from './setup';
    import {info,setInfo} from '../pet/store';
    window.fixture={openShop,openSetup,
      closeShop:()=>document.querySelector('.ui-shop .close')?.click(),
      closeSetup:()=>document.querySelector('.ui-setup .close')?.click(),
      balance:()=>info.yb,setBalance:yb=>setInfo('yb',yb),
      retainSubmit:()=>window.staleSubmit=document.querySelector('.localRecharge .windowViewButSubmit')};
  `
  const stub = `
    export const speak=()=>{},readopt=()=>{},setHidden=()=>{},setFaceClick=()=>{},weatherNow=async()=>'';
    export const goodOf=(type,id)=>({type,id,name:'测试商品',num:1,price:12,url:'pet/img_res/food/102010001.gif'});
    export const TYPE_NAMES={food:'食物',clean:'日用品',medicine:'药品',toy:'玩具',nums:'属性',background:'背景'};
    export const listGoods=()=>({list:[],totalPage:1}),describe=()=>['隔离商品'],onGoodsChange=()=>{};
    export const price=g=>g.price,buy=()=>true,useItem=()=>{};
    export const expandEdgeMini=()=>false;
  `
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' },
    bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'isolated-shop-source', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (['./shop', './setup', '../pet/store', './box', './dom', '../ui/dom', './recharge', '../../shared/recharge', '../pet/data/shop.json', '../../../package.json', './level', './window-view'].includes(args.path)) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const css = ['base.css', 'style.css', 'ui/css/shop.css', 'ui/css/setup.css', 'ui/css/window.css', 'ui/css/recharge.css'].map(p => readFileSync('src/renderer/' + p, 'utf8')).join('\n')
  writeFileSync('dist/ui-shop-prepared.json', JSON.stringify({ code: result.outputFiles[0].text, css }))
}
