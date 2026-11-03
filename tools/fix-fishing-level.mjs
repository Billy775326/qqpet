// Fit double-digit levels inside the fish card's original blue corner badge.
// Usage: node tools/fix-fishing-level.mjs [path/to/main.swf]
import {readFileSync,writeFileSync} from 'node:fs'
import {inflateSync,deflateSync} from 'node:zlib'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'

const file=process.argv[2]??fileURLToPath(new URL('../resources/pet/fishing/main.swf',import.meta.url))
const input=readFileSync(file)
assert.equal(input.subarray(0,3).toString(),'CWS','Expected the original compressed pond SWF')
const body=inflateSync(input.subarray(8))
// DefineEditText 459 is the fish card's level instance. Its 29.5px field is
// clipped by the original badge mask: widening the field cannot reveal more
// text. Keep its geometry and fit lv12 by using 10px text on a single line.
const original=Buffer.from('cb015fd844df608c00ed320100f000','hex')
const updated=Buffer.from('cb015fd844df608c008d320100c800','hex')
const at=body.indexOf(original)
if(at<0){assert.notEqual(body.indexOf(updated),-1,'Unrecognized pond level field');console.log('Fish level label is already fixed');process.exit(0)}
assert.equal(body.indexOf(original,at+1),-1,'Expected one level-field definition')
const sample=body.indexOf(Buffer.from('lv99'),at)
assert.ok(sample>at&&sample<at+300,'Unexpected field content')
const size=body.indexOf(Buffer.from('size="12"'),at)
assert.ok(size>at&&size<sample,'Unexpected level text format')
const output=Buffer.from(body);updated.copy(output,at)
Buffer.from('size="10"').copy(output,size)
assert.equal(output.length,body.length,'Preserve all tag lengths and offsets')
const header=Buffer.from(input.subarray(0,8));header.writeUInt32LE(output.length+8,4)
writeFileSync(file,Buffer.concat([header,deflateSync(output)]))
console.log('Fish level label: 12px -> 10px; single line; badge geometry preserved')
