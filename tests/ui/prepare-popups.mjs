import {writeFileSync} from 'node:fs'
import {build} from 'esbuild'
import {prepareControls} from './prepare-controls.mjs'

export async function preparePopups() {
  await prepareControls({bubble:true})
  const native=await build({stdin:{contents:"export {menuPriority} from './src/main/menu-priority';export {startSave} from './src/shared/save-logic';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node'})
  writeFileSync('dist/ui-popup-native.cjs',native.outputFiles[0].text)
}
