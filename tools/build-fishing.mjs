// Recompile only the reviewed shop/protocol classes; preserve existing art and patches.
// QQPET_TEST_JAVA and QQPET_FFDEC_JAR identify Java and JPEXS FFDec.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const java = process.env.QQPET_TEST_JAVA || 'java'
const compiler = process.env.QQPET_FFDEC_JAR
assert.ok(compiler, 'Set QQPET_FFDEC_JAR to the FFDec JAR')
mkdirSync('dist', { recursive: true })
const work = mkdtempSync(resolve('dist/pond-inline-build-'))
let input = resolve('resources/pet/fishing/main.swf')
assert.equal(readFileSync(input).subarray(0, 3).toString(), 'CWS')
for (const [name, target] of [
  ['BuyProtocol', 'com.tencent.QQPet.FishSNS.Protocol.BuyProtocol'],
  ['FishShop', 'com.tencent.QQPet.FishSNS.View.fishshop.FishShop'],
]) {
  const output = resolve(work, name + '.swf')
  execFileSync(java, ['-Djava.awt.headless=true', '-jar', compiler, '-replace', input, output, target,
    resolve('tools/fishing/src', name + '.as')], { windowsHide: true, stdio: 'inherit' })
  input = output
}
copyFileSync(input, resolve(process.argv[2] || 'resources/pet/fishing/main.swf'))
console.log('Pond quantity controls compiled:', input)
