import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { inflateSync, deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

type Fry = { fryid: number; level: number; flag: number; quantity: number; sell_price: number; canSelected?: boolean }
const catalogue: Fry[] = JSON.parse(readFileSync('src/renderer/pet/data/fries.json', 'utf8'))
const resource = readFileSync('resources/pet/fishing/main.swf')
const bodyOf = (swf: Buffer): Buffer => inflateSync(swf.subarray(8))
const methodAt = (body: Buffer): number => {
  const prefix = Buffer.from('d030ef01ae140000ef01bf140127ef01c114022c', 'hex')
  const at = body.indexOf(prefix)
  assert.ok(at >= 0 && body.indexOf(prefix, at + 1) < 0, 'Recognize exactly one FishShopData.setData method')
  return at
}

/** Run the movie's actual sorting bytecode, stopping before its UI dispatch.
 * Only AVM2 primitives and native Array.sortOn are emulated; the movie supplies
 * all grouping, featured overrides, branches and array operations under test.
 * Purchase eligibility is an input; its unchanged Flash getter is out of scope.
 */
function displayed(input: Fry[]): number[] {
  const body = bodyOf(resource), code = body.subarray(methodAt(body), methodAt(body) + 361)
  const at = body.indexOf(Buffer.from('d030d266890773d166890773a1', 'hex'))
  assert.ok(at >= 0, 'Recognize the movie comparator')
  const compare = body.subarray(at, at + 67)
  const holder = { sortBySelected: (a: Fry, b: Fry) => execute(compare, [null, a, b], 0, 67) }
  return execute(code, [holder, input.map(f => ({ ...f }))], 63, 337).arr.map((f: Fry) => f.fryid)
}

function execute(code: Buffer, locals: any[], start: number, stop: number): any {
  const stack: any[] = []
  const names: Record<number, string> = { 55: 'FryData', 483: 'quantity', 796: 'sortBySelected', 897: 'level', 898: 'sell_price', 905: 'canSelected', 1938: 'sortOn', 2200: 'NUMERIC', 2202: 'DESCENDING', 2479: 'sort', 2746: 'arr', 2747: '*', 2748: 'push', 2749: 'sortOn', 2131: 'concat' }
  const strings: Record<number, string> = { 907: 'level', 915: 'canSelected', 910: 'qbFlag', 909: 'flag' }
  let pc = start, steps = 0
  const u30 = (): number => { let n = 0, shift = 0, b; do { b = code[pc++]!; n |= (b & 127) << shift; shift += 7 } while (b & 128); return n }
  const args = (n: number): any[] => stack.splice(stack.length - n, n)
  while (pc < stop) {
    assert.ok(++steps < 10000, 'Sorting must terminate')
    if (start === 0) assert.ok(stack.length <= 2 && locals.length <= 3, 'Comparator must fit the original AVM2 stack and local limits')
    const op = code[pc++]!
    if (op === 0x02 || op === 0x09 || op === 0x80) { if (op === 0x80) u30(); continue }
    if (op >= 0xd0 && op <= 0xd3) { stack.push(locals[op - 0xd0]); continue }
    if (op >= 0xd4 && op <= 0xd7) { locals[op - 0xd4] = stack.pop(); continue }
    if (op === 0x62) { stack.push(locals[u30()]); continue }
    if (op === 0x63) { locals[u30()] = stack.pop(); continue }
    if (op === 0x24) { stack.push(code.readInt8(pc++)); continue }
    if (op === 0x2c) { const id = u30(); assert.ok(id in strings); stack.push(strings[id]); continue }
    if (op === 0x2a) { stack.push(stack.at(-1)); continue }
    if (op === 0x2b) { const right = stack.pop(), left = stack.pop(); stack.push(right, left); continue }
    if (op === 0x29 || op === 0x30) { stack.pop(); continue }
    if (op === 0x48) return stack.pop()
    if (op === 0xa1 || op === 0xa2) { const right = stack.pop(), left = stack.pop(); stack.push(op === 0xa1 ? left - right : left * right); continue }
    if (op === 0x56) { stack.push(args(u30())); continue }
    if (op === 0x60) { assert.equal(u30(), 54); stack.push({ NUMERIC: 16, DESCENDING: 2 }); continue }
    if (op === 0x5d) { assert.equal(u30(), 55); stack.push(null); continue }
    if (op === 0x4a) { assert.equal(u30(), 55); const a = args(u30()); stack.pop(); stack.push(a[0]); continue }
    if (op === 0x66 || op === 0x61) {
      const id = u30(), key = names[id]; assert.ok(key)
      if (op === 0x61) { const value = stack.pop(); stack.pop()[key] = value }
      else if (key === '*') { const index = stack.pop(); stack.push(stack.pop()[index]) }
      else stack.push(stack.pop()[key])
      continue
    }
    if (op === 0x46 || op === 0x4f) {
      const name = names[u30()], a = args(u30()), target = stack.pop(); let value
      if (name === 'sortOn') {
        const keys: string[] = Array.isArray(a[0]) ? a[0] : [a[0]], flags: number[] = Array.isArray(a[1]) ? a[1] : keys.map(() => a[1])
        value = target.sort((x: any, y: any) => {
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i]!, f = flags[i]!, left = f & 16 ? Number(x[key]) : String(x[key]), right = f & 16 ? Number(y[key]) : String(y[key])
            const c = left < right ? -1 : left > right ? 1 : 0
            if (c) return f & 2 ? -c : c
          }
          return 0
        })
      } else { assert.ok(name === 'push' || name === 'concat' || name === 'sort'); value = target[name](...a) }
      if (op === 0x46) stack.push(value)
      continue
    }
    if (op === 0x32) { const object = u30(), index = u30(); locals[index]++; stack.push(locals[index] <= locals[object].length); continue }
    if (op === 0x1e) { const index = stack.pop(); stack.pop(); stack.push(String(index - 1)); continue }
    if (op === 0x08) { locals[u30()] = undefined; continue }
    if (op === 0x73 || op === 0x85) { stack.push(op === 0x73 ? Number(stack.pop()) : String(stack.pop())); continue }
    if (op === 0x82) continue
    if (op === 0x87) { stack.pop(); continue }
    if (op === 0x10 || op === 0x11 || op === 0x12) {
      let offset = code.readIntLE(pc, 3); pc += 3
      if (op === 0x10 || (op === 0x11 ? !!stack.pop() : !stack.pop())) pc += offset
      continue
    }
    assert.fail(`Unsupported AVM2 opcode ${op.toString(16)} at ${pc - 1}`)
  }
  return locals[0]
}

test('the pond movie groups eligible fish first and sorts every group by increasing level', () => {
  for (const level of [0, 6, 10, 15, 35, 50]) for (const vip of [false, true]) {
    const input = catalogue.map(f => ({ ...f, canSelected: f.level <= level && (!f.flag || vip) }))
    const result = displayed(input)
    assert.equal(result.length, catalogue.length)
    assert.equal(new Set(result).size, catalogue.length, 'No fish disappears or appears twice')
    let locked = false, previous = -1
    for (const id of result) {
      const f = input.find(f => f.fryid === id)!
      if (!f.canSelected && !locked) { locked = true; previous = -1 }
      if (locked) assert.equal(f.canSelected, false, 'Eligible fish cannot appear behind locked fish')
      assert.ok(f.level >= previous, `Level order at level ${level}, vip ${vip}: ${result}`)
      previous = f.level
    }
    assert.equal(result[0], 2, 'The first card is the level-zero goldfish, with no featured override')
  }
})

test('the actual Flash comparator orders equal-level fish by total harvest income', () => {
  const fish = (fryid: number, quantity: number, sell_price: number, canSelected = true): Fry => ({ fryid, level: 3, flag: 0, quantity, sell_price, canSelected })
  assert.deepEqual(displayed([fish(100, 1, 100), fish(101, 10, 5), fish(102, 2, 5), fish(103, 1, 1, false)]), [102, 101, 100, 103])
  assert.deepEqual(displayed([fish(100, 1, 100, false), fish(101, 10, 5, false), fish(102, 2, 5, false)]), [102, 101, 100])
})

test('pond ordering patch is repeatable and preserves unrelated movie content', () => {
  mkdirSync('dist', { recursive: true })
  const file = join(mkdtempSync(resolve('dist/pond-order-')), 'main.swf')
  writeFileSync(file, resource)
  const run = (): void => { const r = spawnSync(process.execPath, ['tools/fix-fishing-order.mjs', file], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr) }
  run(); assert.deepEqual(readFileSync(file), resource)
  const patched = bodyOf(resource), legacy = Buffer.from(patched), at = methodAt(patched)
  Buffer.from('d266df032421ab2a1108000029d266df032422ab120a0000d3d24fcd0e0110090000', 'hex').copy(legacy, at + 132)
  Buffer.from('d066ba152c93072c8b072c8e072c8d0756046036669a1160366698116036669a116036669a1156044fbd1502', 'hex').copy(legacy, at + 186)
  Buffer.from('2400736306102c000009d066ba15620666bb156037878037d6d2668307240114100000d066ba15620624014fbe1502100f0000c2066206d066ba1566bf1515c7ffffd2120d0000d066ba15d24fc01501100a000060eb022cc9114fcc0801', 'hex').copy(legacy, at + 230)
  writeFileSync(file, Buffer.concat([resource.subarray(0, 8), deflateSync(legacy)]))
  run(); assert.deepEqual(bodyOf(readFileSync(file)), patched, 'Patch the recognized legacy shop without changing unrelated content')
  run(); assert.deepEqual(bodyOf(readFileSync(file)), patched)
  legacy[at + 20] ^= 1
  const unknown = Buffer.concat([resource.subarray(0, 8), deflateSync(legacy)])
  writeFileSync(file, unknown)
  assert.notEqual(spawnSync(process.execPath, ['tools/fix-fishing-order.mjs', file]).status, 0)
  assert.deepEqual(readFileSync(file), unknown, 'Unrecognized movies must not be overwritten')
})
