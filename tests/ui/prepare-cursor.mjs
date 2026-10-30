import {readFileSync,writeFileSync} from 'node:fs'
import {build} from 'esbuild'
export async function prepareCursor(){
  const result=await build({entryPoints:['src/renderer/swf/cursor.ts'],bundle:true,write:false,format:'iife',globalName:'cursorFixture'})
  const css=['base.css','style.css','ui/css/control.css','ui/css/edge-mini.css','ui/css/chat.css','ui/css/album.css'].map(p=>readFileSync('src/renderer/'+p,'utf8')).join('\n')
  writeFileSync('dist/ui-cursor-prepared.json',JSON.stringify({code:result.outputFiles[0].text,css}))
}
