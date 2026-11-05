// Farm.swf partitions this catalogue into buyable and unavailable seeds,
// preserving catalogue order inside each group. Sort its numeric keys here.
// Usage: node tools/sort-farm-seeds.mjs [path/to/seed.xml]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const file = process.argv[2] ?? fileURLToPath(new URL('../resources/pet/qqfarm/com/MyFarm/data/xml/seed.xml', import.meta.url))
const input = readFileSync(file, 'utf8')
const item = /<item\b[^>]*>[\s\S]*?<\/item>/g
const entries = [...input.matchAll(item)].map(([xml]) => {
  const number = key => {
    const match = xml.match(new RegExp(`\\b${key}="([^"]+)"`))
    assert.ok(match, `Missing seed ${key}`)
    const n = Number(match[1])
    assert.ok(Number.isFinite(n) && n >= 0, `Invalid seed ${key}`)
    return n
  }
  return { xml, level: number('rank'), income: number('yield') * number('prices') }
})
assert.ok(entries.length > 0, 'No seed catalogue entries found')
entries.sort((a, b) => a.level - b.level || a.income - b.income)
let index = 0
const output = input.replace(item, () => entries[index++].xml)
if (output !== input) writeFileSync(file, output)
console.log('Farm seeds: increasing level, then increasing harvest income; existing availability grouping retained')
