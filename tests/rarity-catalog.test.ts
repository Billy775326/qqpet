import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const goods=JSON.parse(readFileSync('src/renderer/pet/data/goods.json','utf8'))
const catalogue=JSON.parse(readFileSync('src/renderer/pet/data/rarity.json','utf8'))
const types=['food','clean','medicine','toy','background','nums']

test('every registered inventory item has one reviewed class and all stored IDs remain unchanged',()=>{
  const actual=types.flatMap(type=>Object.values(goods[type]).map((g:any)=>g.id)).sort()
  const classified=Object.values(catalogue.classes).flat() as string[]
  assert.equal(classified.length,910)
  assert.equal(new Set(classified).size,910)
  assert.deepEqual([...classified].sort(),actual)
  assert.deepEqual(Object.fromEntries(Object.entries(catalogue.classes).map(([k,v])=>[k,(v as string[]).length])),{common:244,collectible:219,rare:52,discontinued:395})
  assert.equal(catalogue.reviews.length,11)
})

test('classification is visible in original item descriptions without rewriting historical text',async()=>{
  const result=await build({stdin:{contents:"export * from './goods';export * from './rarity'",resolveDir:resolve('src/renderer/pet/data'),loader:'ts'},bundle:true,write:false,format:'cjs'})
  const module={exports:{}} as any
  runInNewContext(result.outputFiles[0].text,{module,exports:module.exports})
  const api=module.exports
  const shark=api.goodOf('food','100010390')
  assert.equal(shark.desc,'天天鱼乐活动获得！')
  assert.ok(api.describe(shark).includes('分类：绝版'))
  assert.equal(api.rarityOf({id:'100010282'}),'common')
  assert.equal(api.rarityOf({id:'100010106'}),'collectible')
  assert.equal(api.rarityOf({id:'100010044'}),'rare')
  assert.equal(api.rarityOf({id:'100010449'}),'discontinued')
  assert.ok(!api.describe(api.goodOf('background','b0000000')).some((line:string)=>line.startsWith('分类：')))
})
