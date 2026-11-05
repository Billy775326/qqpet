import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const xml = readFileSync('resources/pet/qqfarm/com/MyFarm/data/xml/seed.xml', 'utf8')
function entries(source: string) {
  return [...source.matchAll(/<item\b([^>]*)>/g)].map(([, attributes]) => {
    const a = Object.fromEntries([...attributes!.matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
    return { id: a.object, level: Number(a.rank), price: Number(a.price), unitPrice: Number(a.prices) }
  })
}

test('farm catalogue preserves level and crop sale unit price order within both availability groups', () => {
  const seeds = entries(xml)
  assert.equal(new Set(seeds.map(s => s.id)).size, seeds.length)
  for (const level of [1, 2, 4, 7, 9]) for (const balance of [0, 75, 100, 50000]) {
    const canBuy = (s: typeof seeds[number]) => s.level <= level && s.price <= balance
    // Stable subsets retain catalogue order; the live shop ordering is checked by the Ruffle regression.
    const shown = [...seeds.filter(canBuy), ...seeds.filter(s => !canBuy(s))]
    let locked = false, previous = { level: -1, unitPrice: -1 }
    for (const seed of shown) {
      if (!canBuy(seed) && !locked) { locked = true; previous = { level: -1, unitPrice: -1 } }
      if (locked) assert.equal(canBuy(seed), false)
      assert.ok(seed.level > previous.level || seed.level === previous.level && seed.unitPrice >= previous.unitPrice)
      previous = seed
    }
  }
})

test('seed sorter uses sale unit price regardless of yield, preserves metadata and is repeatable', () => {
  mkdirSync('dist', { recursive: true })
  const file = join(mkdtempSync(resolve('dist/farm-order-')), 'seed.xml')
  const input = '<?xml version="1.0"?><data>\n' + [
    '<item object="b" name="B" rank="1" price="5" yield="1" prices="100">description B</item>',
    '<item object="c" name="C" rank="2" price="1" yield="1" prices="1"></item>',
    '<item object="a" name="A" rank="1" price="100" yield="100" prices="5"><![CDATA[description A]]></item>',
  ].join('\n') + '\n</data>'
  writeFileSync(file, input)
  const run = () => spawnSync(process.execPath, ['tools/sort-farm-seeds.mjs', file], { encoding: 'utf8' })
  assert.equal(run().status, 0)
  const output = readFileSync(file, 'utf8')
  assert.deepEqual(entries(output).map(s => s.id), ['a', 'b', 'c'])
  assert.deepEqual([...output.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/g)].map(m => m[0]).sort(), [...input.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/g)].map(m => m[0]).sort())
  assert.equal(run().status, 0)
  assert.equal(readFileSync(file, 'utf8'), output)
  writeFileSync(file, '<data><item rank="bad"></item></data>')
  assert.notEqual(run().status, 0)
  assert.equal(readFileSync(file, 'utf8'), '<data><item rank="bad"></item></data>')
})
