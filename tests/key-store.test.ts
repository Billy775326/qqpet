import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createKeyStore } from '../src/main/key-store.ts'

function fixture() {
  mkdirSync(resolve('dist'), { recursive: true })
  const file = join(mkdtempSync(resolve('dist/key-store-test-')), 'credentials.bin')
  const key = randomBytes(32)
  const provider = {
    available: () => true,
    encrypt(value: string) { const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',key,iv);const b=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]) },
    decrypt(value: Buffer) { const c=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));c.setAuthTag(value.subarray(12,28));return Buffer.concat([c.update(value.subarray(28)),c.final()]).toString('utf8') },
  }
  return {file,provider}
}
test('encrypted credentials survive a fresh store and contain no plaintext key',()=>{
  const {file,provider}=fixture()
  createKeyStore(file,provider).save('TEST_SECRET','https://service/v1')
  assert.equal(readFileSync(file).includes(Buffer.from('TEST_SECRET')),false)
  assert.equal(createKeyStore(file,provider).load('https://service/v1'),'TEST_SECRET')
})
test('another user or corrupt ciphertext is recoverable and preserved',()=>{
  const {file,provider}=fixture()
  createKeyStore(file,provider).save('TEST_SECRET','url')
  const before=readFileSync(file)
  const locked=createKeyStore(file,{...provider,decrypt(){throw new Error('different user')}})
  assert.equal(locked.load('url'),'')
  assert.match(locked.status(),/重新输入/)
  assert.deepEqual(readFileSync(file),before)
  writeFileSync(file,'broken')
  assert.equal(createKeyStore(file,provider).load('url'),'')
})
test('unavailable storage never writes plaintext or overwrites existing ciphertext',()=>{
  const {file,provider}=fixture()
  const off={...provider,available:()=>false}
  createKeyStore(file,off).save('TEST_SECRET','url')
  assert.equal(existsSync(file),false)
  createKeyStore(file,provider).save('OLD_SECRET','url')
  const before=readFileSync(file)
  createKeyStore(file,off).save('NEW_SECRET','url')
  assert.deepEqual(readFileSync(file),before)
})
test('URL binding prevents replay; replacement and explicit clearing work',()=>{
  const {file,provider}=fixture()
  const store=createKeyStore(file,provider)
  store.save('OLD_SECRET','old-url')
  assert.equal(store.load('new-url'),'')
  store.save('NEW_SECRET','new-url')
  assert.equal(createKeyStore(file,provider).load('new-url'),'NEW_SECRET')
  store.save('','new-url')
  assert.equal(existsSync(file),false)
  assert.equal(createKeyStore(file,provider).load('new-url'),'')
})

test('encryption failures preserve the old ciphertext and advertise session-only use',()=>{
  const {file,provider}=fixture()
  createKeyStore(file,provider).save('OLD','url')
  const before=readFileSync(file)
  const store=createKeyStore(file,{...provider,encrypt(){throw new Error('keyring locked')}})
  store.save('NEW','url')
  assert.deepEqual(readFileSync(file),before)
  assert.match(store.status(),/本次运行仍可使用/)
})
