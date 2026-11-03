import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { inflateSync, deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'

const rectBytes = (data: Buffer, at: number): number => Math.ceil((5 + 4 * (data[at]! >> 3)) / 8)
function levelField(body: Buffer): { start: number; data: Buffer; flagsAt: number } {
  let at = rectBytes(body, 0) + 4
  while (at + 2 <= body.length) {
    const tag = body.readUInt16LE(at); at += 2
    let size = tag & 63
    if (size === 63) { size = body.readUInt32LE(at); at += 4 }
    assert.ok(at + size <= body.length, 'SWF tag must stay within the declared payload')
    if ((tag >> 6) === 37 && size >= 2 && body.readUInt16LE(at) === 459) {
      const data = body.subarray(at, at + size)
      return { start: at, data, flagsAt: 2 + rectBytes(data, 2) }
    }
    if ((tag >> 6) === 0) break
    at += size
  }
  throw Error('Fish shop level text field 459 is missing')
}

test('fish level SWF uses 10px single-line text inside the original badge geometry', () => {
  const swf = readFileSync('resources/pet/fishing/main.swf')
  assert.equal(swf.subarray(0, 3).toString(), 'CWS', 'LFS must materialize the real compressed asset')
  const body = inflateSync(swf.subarray(8))
  assert.equal(swf.readUInt32LE(4), body.length + 8)
  const { data, flagsAt } = levelField(body)
  const flags = data[flagsAt]! // SWF UB fields are MSB-first within this byte.
  assert.equal(flags & 0x60, 0, 'word wrap and multiline must be disabled')
  assert.ok(flags & 0x01, 'font settings must be present')
  assert.equal(data.readUInt16LE(flagsAt + 4), 200, 'font height is 200 twips / 10 pixels')
  assert.match(data.toString('latin1'), /size="10"/)
  assert.match(data.toString('latin1'), /lv99/)
  assert.equal(data.subarray(2, flagsAt).toString('hex'), '5fd844df608c00', 'preserve the original badge text bounds')
})

test('fish level patch repairs a legacy field and is repeatable without further changes', () => {
  const current = readFileSync('resources/pet/fishing/main.swf')
  const expected = inflateSync(current.subarray(8))
  const { start, data, flagsAt } = levelField(expected)
  const legacy = Buffer.from(expected)
  legacy[start + flagsAt] = data[flagsAt]! | 0x60
  legacy.writeUInt16LE(240, start + flagsAt + 4)
  const htmlSize = data.indexOf(Buffer.from('size="10"'))
  assert.ok(htmlSize >= 0)
  Buffer.from('size="12"').copy(legacy, start + htmlSize)
  mkdirSync(resolve('dist'), { recursive: true })
  const directory = mkdtempSync(resolve('dist/fishing-label-test-'))
  const file = join(directory, 'legacy.swf')
  writeFileSync(file, Buffer.concat([current.subarray(0, 8), deflateSync(legacy)]))
  const run = () => {
    const result = spawnSync(process.execPath, ['tools/fix-fishing-level.mjs', file], { encoding: 'utf8', windowsHide: true, timeout: 10_000 })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr || result.stdout)
  }
  run()
  const patched = readFileSync(file)
  assert.deepEqual(inflateSync(patched.subarray(8)), expected, 'only the intended font and wrapping edits must be needed')
  run()
  assert.deepEqual(readFileSync(file), patched, 'applying the patch again must preserve the asset')
})
