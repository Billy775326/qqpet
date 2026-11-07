import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { hidpiSvg } from '../src/main/hidpi.ts'

const asset = (path: string): string => fileURLToPath(new URL(`../resources/pet/${path}`, import.meta.url))

test('sweetheart badges keep original lettering even when the faulty HD twins exist', () => {
  for (const name of ['h_up', 'h_down']) {
    const original = asset(`stateInfo/${name}.png`)
    const redraw = readFileSync(asset(`stateInfo/${name}@2x.png`))
    assert.equal(redraw.readUInt32BE(16), 134)
    assert.equal(redraw.readUInt32BE(20), 30)
    assert.equal(hidpiSvg(original), undefined, 'the protocol must fall through to the original PNG')
  }
})

test('other HD artwork still uses its high-resolution twin at the original layout size', () => {
  const svg = hidpiSvg(asset('Menu/ditu03.png'))!
  assert.match(svg, /width="20" height="7"/)
  const redraw = readFileSync(asset('Menu/ditu03@2x.png')).toString('base64')
  assert.ok(svg.includes(`data:image/png;base64,${redraw}`))
})
