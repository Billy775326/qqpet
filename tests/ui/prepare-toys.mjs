import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareToys() {
  const entry = `
    import {openShop} from './shop';
    import {save,info,setInfo} from '../pet/store';
    import {allGoods} from '../pet/data/goods';
    window.fixture={openShop,save,info,setInfo,toys:allGoods('toy')};
  `
  const allowed = ['./shop','../pet/store','./store','../pet/data/goods','./data/goods','./goods','./inventory','../pet/goods','./items','../pet/items','./tasks','./milestones','./box','./dom','../ui/dom','./date','./recharge','../../shared/recharge','./level','./window-view','../ui/window-view','./goods.json','../pet/data/shop.json']
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' }, bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'isolated-toy-shop', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || allowed.includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
        export const speak=(_line,_action,hooks={})=>hooks.start?.(),floatMood=()=>{},loot=()=>[],rand=min=>min,dayStart=()=>1000;
        export const DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}}),expandEdgeMini=()=>false;
      ` }))
    } }],
  })
  const css = ['base.css','style.css','ui/css/shop.css','ui/css/window.css','ui/css/recharge.css'].map(p => readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-toys-prepared.json', JSON.stringify({ code: result.outputFiles[0].text, css }))
}
