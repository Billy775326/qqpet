// Usage: node tools/fix-fishing-order.mjs [path/to/main.swf]
// Remove the legacy featured-fish overrides from FishShopData.setData.
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

// Match the complete method so a different movie cannot be patched accidentally.
const original = Buffer.from([
  'd030ef01ae140000ef01bf140127ef01c114022cef01bc14032def018a150428ef018b150529208037d620856305240073630660eb022cc511d1a04fcc0801d0560061ba1556008036d7d160368780362a63042c8b0760366698114f920f022400630762048263081043000009620862071e8563055d376204620566bb154a37018037d6',
  'd266df032421ab2a1108000029d266df032422ab120a0000d3d24fcd0e0110090000',
  'd066ba15d24fbc150132080711b6ffff08080807d066ba152c93072c8b072c8e072c8d0756046036669a1160366698116036669a116036669a1156044fbd1502',
  '2400736306102c000009d066ba15620666bb156037878037d6d2668307240114100000d066ba15620624014fbe1502100f0000c2066206d066ba1566bf1515c7ffffd2120d0000d066ba15d24fc01501100a000060eb022cc9114fcc0801',
  'd0d3d066ba1546d3100161ba15602746c80b0066c1155d08600866a80c4a08014fc2150147',
].join(''), 'hex')
const updated = Buffer.from(original)
// NOP the branch which diverts fry IDs 33/34 into a featured list, and the
// loop which promotes one diamond fish. Keep every instruction/branch offset,
// ABC body length and SWF tag length unchanged. The existing sortOn remains:
// canSelected descending, then level numeric ascending (legacy tie breakers).
updated.fill(0x02, 132, 166)
updated.fill(0x02, 230, 324)

const file = process.argv[2] ?? fileURLToPath(new URL('../resources/pet/fishing/main.swf', import.meta.url))
const input = readFileSync(file)
assert.equal(input.subarray(0, 3).toString(), 'CWS', 'Expected a compressed pond SWF')
const body = inflateSync(input.subarray(8))
assert.equal(input.readUInt32LE(4), body.length + 8, 'Invalid SWF length')
const at = body.indexOf(original)
if (at < 0) {
  const patched = body.indexOf(updated)
  assert.ok(patched >= 0 && body.indexOf(updated, patched + 1) < 0, 'Unrecognized pond shop method')
  console.log('Pond shop ordering is already fixed')
} else {
  assert.equal(body.indexOf(original, at + 1), -1, 'Expected one pond shop method')
  const output = Buffer.from(body)
  updated.copy(output, at)
  writeFileSync(file, Buffer.concat([input.subarray(0, 8), deflateSync(output)]))
  console.log('Pond shop: eligible fish first, then increasing level; featured overrides removed')
}
