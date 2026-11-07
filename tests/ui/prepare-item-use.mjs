import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareItemUse() {
  const allowed = ['../pet/acquisition','./care-settings','./loot','./reward-icon','./signin','../pet/signin','./result','./window-view','../ui/window-view','./dom','../ui/dom','./box','./frame','../pet/items','./items','../pet/care','./care','./inventory','./goods','../pet/goods','./data/goods','../pet/data/goods','./acquisition','./data/task-definitions','./milestones','../../shared/save-logic','./store','../pet/store','./level']
  const result = await build({
    stdin: { contents: `import {openCareSettings} from './care-settings';import {openSignIn} from './signin';import {useItem} from '../pet/items';import {selfCare} from '../pet/care';
      import {save,info} from '../pet/store';import {quantityOf,addGood} from '../pet/goods';import {goodOf,allGoods} from '../pet/data/goods';
      window.testProtection={};window.itemUseHooks=[];window.itemUseCounts=0;
      window.fixture={openCareSettings,openSignIn,allGoods,save,info,quantityOf,addGood,selfCare,use:(type,id)=>useItem(goodOf(type,id)),run:()=>window.itemUseHooks.splice(0).forEach(f=>f())};`, resolveDir: resolve('src/renderer/ui'), loader: 'ts' },
    bundle: true, write: false, format: 'esm', plugins: [{ name: 'isolated-item-use-ui', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) || allowed.includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /rarity\.ts$/ }, args => ({ contents: readFileSync(args.path, 'utf8').replace(
        "byId.get(g.id) ?? 'common'", "window.testProtection[g.id] ?? byId.get(g.id) ?? 'common'"
      ), loader: 'ts' }))
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
        export const speak=(_l,_a,h={})=>{if(h.start)window.itemUseHooks.push(h.start);if(h.end)window.itemUseHooks.push(h.end)},floatMood=()=>{},addCount=()=>window.itemUseCounts++;
        export const rand=min=>min,dayStart=()=>Math.floor(Date.now()/86400000)*86400;
        export const DEAD={cure:{id:'60001'}},illOf=()=>({cure:{id:'10001'},successTolk:'healed',errTolk:'wrong'});` }))
    } }],
  })
  const css = ['base.css','style.css','ui/css/window.css','ui/css/frame.css','ui/css/signin.css','ui/css/care-settings.css'].map(p => readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-item-use-prepared.json',JSON.stringify({code:result.outputFiles[0].text,css}))
}
