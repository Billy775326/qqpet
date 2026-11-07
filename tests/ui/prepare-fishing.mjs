import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'esbuild'

export async function prepareFishing(){
  const allowed=['./fishing','../pet/fishing','./store','../pet/store','./level','./data/goods','./dom','../ui/dom','./box','./window-view','../ui/window-view','../swf/player']
  const bundled=await build({stdin:{contents:`import {openFishing} from './fishing';import {save,info,setInfo,syncLevel} from '../pet/store';
    window.fixture={openFishing,save,info,setInfo,syncLevel,purchase:(fryid=2,paytype=1)=>window.PETSendData(JSON.stringify({head:{cmd:4},data:{fryid,paytype}}))};`,resolveDir:resolve('src/renderer/ui'),loader:'ts'},bundle:true,write:false,format:'esm',plugins:[{name:'isolated-real-pond',setup(b){
      b.onResolve({filter:/.*/},args=>{if(!args.importer|| ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) ||allowed.includes(args.path)||args.path.endsWith('.json'))return;return{path:args.path,namespace:'mock'}})
      b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:''}))
    }}]})
  const css=['base.css','style.css','ui/css/fishing.css','ui/css/window.css'].map(p=>readFileSync('src/renderer/'+p,'utf8')).join('\n')
  const native=await build({stdin:{contents:"export {startSave,applyPatch} from './src/shared/save-logic'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node'})
  writeFileSync('dist/ui-fishing-save.cjs',native.outputFiles[0].text)
  writeFileSync('dist/ui-fishing-prepared.json',JSON.stringify({code:bundled.outputFiles[0].text,css}))
}
