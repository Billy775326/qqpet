import assert from 'node:assert/strict'
import test from 'node:test'
import { startSave, applyPatch, validatedImport, publicSave } from '../src/shared/save-logic.ts'

test('malformed imported groups are rejected before replacement', () => {
  assert.throws(() => validatedImport(null))
  assert.throws(() => validatedImport({ havePet: true, petInfo: 'broken' }))
})
test('malformed existing groups and embedded JSON recover', () => {
  const save = startSave({ havePet: true, petInfo: 'broken', saveJsonData: { task: '{', signin: '{"collectionList":{"2026":"bad"}}' } })
  assert.equal(typeof save.petInfo.name, 'string')
  assert.equal(save.saveJsonData.task, undefined)
  assert.equal(save.saveJsonData.signin, undefined)
  assert.equal(save.saveNum, 0)
})
test('prototype pollution and unknown patch keys are rejected atomically', () => {
  for (const input of ['{"__proto__":{"polluted":true}}', '{"settings":{"__proto__":{"polluted":true}}}', '{"petInfo":{"name":"changed"},"unknown":true}']) {
    const save = startSave(null)
    const before = JSON.stringify(save)
    assert.throws(() => applyPatch(save, JSON.parse(input)))
    assert.equal(JSON.stringify(save), before)
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined)
})
test('normal partial patches and feature-owned blobs persist', () => {
  const save = startSave(null)
  applyPatch(save, { petInfo: { name: '测试' }, saveJsonData: { activity: '2.5' } })
  assert.equal(save.petInfo.name, '测试')
  assert.equal(save.saveJsonData.activity, '2.5')
})
test('secrets never enter disk snapshots or exports; session remains usable', () => {
  const save = startSave(null)
  save.settings.aiKey = 'DUMMY_SECRET'
  assert.equal(JSON.stringify(publicSave(save)).includes('DUMMY_SECRET'), false)
  assert.equal(save.settings.aiKey, 'DUMMY_SECRET')
})
test('legacy wrapper imports remain supported', () => {
  const save = startSave(null)
  save.havePet = true
  assert.equal(validatedImport({ petInfoData: save }).havePet, true)
})
