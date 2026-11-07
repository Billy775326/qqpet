import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'esbuild'

export async function prepareInventory() {
  const allowed=['./setup','./inventory-grant','./email','../pet/mail','./mail','./inventory','../pet/goods','./goods','./store','../pet/store','./data/goods','../pet/data/goods','./level','./dom','../ui/dom','./box','./frame','./date','./window-view','./reward-icon']
  const result=await build({
    stdin:{contents:`import {openSetup} from './setup';import {openEmail} from './email';import {openInventoryGrant} from './inventory-grant';
      import {save} from '../pet/store';import {readMails,mailInventoryGrant,mailPhoto} from '../pet/mail';
      import {quantityOf} from '../pet/goods';
      window.fixture={openSetup,openEmail,openInventoryGrant,save,readMails,mailInventoryGrant,mailPhoto,quantityOf};`,resolveDir:resolve('src/renderer/ui'),loader:'ts'},
    bundle:true,write:false,format:'esm',plugins:[{name:'isolated-inventory-ui',setup(b){
      b.onResolve({filter:/.*/},args=>{
        if(!args.importer||allowed.includes(args.path)||args.path.endsWith('.json'))return
        return {path:args.path,namespace:'mock'}
      })
      b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const speak=()=>{},weatherNow=async()=>'',readopt=()=>{},setHidden=()=>{},setFaceClick=()=>{},expandEdgeMini=()=>false;
        export const isBuddy=()=>false,photoUrl=()=>'',openPhoto=()=>{},rand=min=>min;`}))
    }}],
  })
  const native=await build({stdin:{contents:"export {startSave,applyPatch,validatedImport} from './src/shared/save-logic';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node'})
  writeFileSync('dist/ui-inventory-save.cjs',native.outputFiles[0].text)
  const css=['base.css','style.css','ui/css/setup.css','ui/css/email.css','ui/css/window.css','ui/css/frame.css'].map(p=>readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-inventory-prepared.json',JSON.stringify({code:result.outputFiles[0].text,css}))
}
