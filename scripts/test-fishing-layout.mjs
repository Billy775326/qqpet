// Measure real Flash control bounds in an isolated instrumented copy.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, copyFileSync, symlinkSync } from 'node:fs'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'

const compiler = process.env.QQPET_FFDEC_JAR
assert.ok(compiler, 'Set QQPET_FFDEC_JAR to the FFDec JAR')
const java = process.env.QQPET_TEST_JAVA || 'java'
mkdirSync('dist', {recursive:true})
const output = mkdtempSync(resolve('dist/pond-layout-probe-'))
const baseline = process.argv[2]
if (baseline) assert.match(baseline, /^[0-9a-f]{7,40}$/)
let source = baseline
  ? execFileSync('git',['show',baseline+':tools/fishing/src/FishShop.as'],{encoding:'utf8'})
  : readFileSync('tools/fishing/src/FishShop.as','utf8')
assert.equal(source.split('this.initQuantity();').length, 2)
source = source.replace('this.initQuantity();','this.initQuantity();\n         ExternalInterface.addCallback("QQPetStockLayout",this.stockLayoutForTest);')
const end = source.lastIndexOf('\n   }')
assert.ok(end > 0)
source = source.slice(0,end)+'\n'+readFileSync('tests/ui/fishing-layout-probe.as.txt','utf8')+source.slice(end)
writeFileSync(join(output,'FishShop.as'),source)
const resources = join(output,'resources'), pet = join(resources,'pet'), fishing = join(pet,'fishing')
mkdirSync(fishing,{recursive:true})
for (const entry of readdirSync('resources/pet',{withFileTypes:true})) {
  if(entry.name==='fishing') continue
  const from=resolve('resources/pet',entry.name), to=join(pet,entry.name)
  entry.isDirectory() ? symlinkSync(from,to,'junction') : copyFileSync(from,to)
}
copyFileSync('resources/pet/fishing/config.xml',join(fishing,'config.xml'))
symlinkSync(resolve('resources/pet/fishing/res'),join(fishing,'res'),'junction')
execFileSync(java,['-Djava.awt.headless=true','-jar',compiler,'-replace',resolve('resources/pet/fishing/main.swf'),
  join(fishing,'main.swf'),'com.tencent.QQPet.FishSNS.View.fishshop.FishShop',join(output,'FishShop.as')],{windowsHide:true,stdio:'inherit'})
const env={...process.env,QQPET_TEST_RESOURCES:resources,QQPET_TEST_FISHING_LAYOUT:'1'}
const result=await new Promise((ok,fail)=>{
  const child=spawn(process.execPath,['scripts/test-ui.mjs','fishing'],{env,windowsHide:true,stdio:'inherit'})
  child.once('error',fail)
  child.once('exit',(code,signal)=>signal ? fail(Error('Layout test terminated: '+signal)) : ok(code))
})
console.log('Native layout fixture:',output)
process.exitCode = typeof result === 'number' ? result : 1
