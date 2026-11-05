// Usage: node tools/fix-fishing-order.mjs [path/to/main.swf]
// Order the pond's real FryData objects by eligibility, level and sale unit price.
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
const previous = Buffer.from(original)
// NOP the branch which diverts fry IDs 33/34 into a featured list, and the
// loop which promotes one diamond fish. Keep every original branch target,
// ABC body length and SWF tag length unchanged.
previous.fill(0x02, 132, 166)
previous.fill(0x02, 230, 324)
const updated = Buffer.from(previous)
// Replace Array.sortOn with Array.sort(this.sortBySelected). The old method
// only compared checkbox selection; it is repurposed below as a numeric comparator.
updated.fill(0x02, 186, 230)
Buffer.from('d066ba15d0669c064faf1301', 'hex').copy(updated, 186)
const oldCompare = Buffer.from('d030ef01ae140000ef01af140100d166880726ab2a1207000029d266880727ab1203000024ff48d166880727ab2a1207000029d266880726ab12030000240148240048', 'hex')
const harvestCompare = Buffer.from('d030d266890773d166890773a12a120100004829d1668107d2668107a12a120100004829d1668207d166e303a2d4d2668207d266e303a2d02ba1480202020202020202', 'hex')
const compare = []
const labels = new Map(), branches = []
const emit = (...bytes) => compare.push(...bytes)
const property = (local, id) => emit(local, 0x66, (id & 127) | 128, id >> 7)
const nextIfEqual = label => { emit(0x2a, 0x12); branches.push([compare.length, label]); emit(0, 0, 0, 0x48); labels.set(label, compare.length); emit(0x29) }
emit(0xd0, 0x30)
// b.canSelected - a.canSelected puts eligible items before locked items.
property(0xd2, 905); emit(0x73); property(0xd1, 905); emit(0x73, 0xa1); nextIfEqual('level')
property(0xd1, 897); property(0xd2, 897); emit(0xa1); nextIfEqual('unitPrice')
// sell_price is the harvest sale price per fish; quantity does not affect order.
// This also stays within the original method's maximum stack depth of two.
property(0xd1, 898); property(0xd2, 898); emit(0xa1, 0x48)
for (const [offset, label] of branches) {
  const delta = labels.get(label) - (offset + 3)
  compare.splice(offset, 3, delta & 255, (delta >> 8) & 255, (delta >> 16) & 255)
}
assert.ok(compare.length <= oldCompare.length, 'Comparator must fit the original method body')
const newCompare = Buffer.alloc(oldCompare.length, 0x02)
Buffer.from(compare).copy(newCompare)

const file = process.argv[2] ?? fileURLToPath(new URL('../resources/pet/fishing/main.swf', import.meta.url))
const input = readFileSync(file)
assert.equal(input.subarray(0, 3).toString(), 'CWS', 'Expected a compressed pond SWF')
const body = inflateSync(input.subarray(8))
assert.equal(input.readUInt32LE(4), body.length + 8, 'Invalid SWF length')
const recognized = (variants, label) => {
  const matches = variants.flatMap(bytes => { const at = body.indexOf(bytes); if (at < 0) return []; assert.equal(body.indexOf(bytes, at + 1), -1, `Duplicate ${label}`); return [{ at, bytes }] })
  assert.equal(matches.length, 1, `Unrecognized pond ${label}`)
  return matches[0]
}
const main = recognized([original, previous, updated], 'shop method')
const comparator = recognized([oldCompare, harvestCompare, newCompare], 'comparator')
const output = Buffer.from(body)
updated.copy(output, main.at)
newCompare.copy(output, comparator.at)
if (output.equals(body)) console.log('Pond shop ordering is already fixed')
else {
  writeFileSync(file, Buffer.concat([input.subarray(0, 8), deflateSync(output)]))
  console.log('Pond shop: eligible first, increasing level, then increasing sale unit price')
}
