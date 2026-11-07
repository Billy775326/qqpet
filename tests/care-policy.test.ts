import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { selectCareStudy, selectCareWork } from '../src/renderer/pet/care-policy.ts'
import { startSave, applyPatch, validatedImport } from '../src/shared/save-logic.ts'
import type { Good } from '../src/renderer/pet/data/goods.ts'
import type { StudyInfo } from '../src/shared/save.ts'

const data = JSON.parse(readFileSync(new URL('../src/renderer/pet/data/goods.json', import.meta.url), 'utf8'))
const good = (type: string, id: string): Good => ({ ...data[type]['_' + id], num: 1 })
const studies = (progress: StudyInfo): Good[] => Object.entries(progress).map(([key, value]) =>
  good('study', `${value <= 9 ? 'xx' : value <= 30 ? 'zx' : value <= 71 ? 'dx' : value <= 167 ? 'yjs' : 'xwzj'}-${key}`),
)

test('focused lessons hold their subject through manual exams and advance after graduation', () => {
  const p = startSave(null).studyInfo
  p.chinese = 9
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'chinese'), undefined)
  p.chinese = 10
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'chinese')?.id, 'zx-chinese')
  p.chinese = 168
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'chinese')?.id, 'xx-mathematics')
  p.mathematics = 9
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'chinese'), undefined)
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'music')?.id, 'xx-music')
})

test('balanced lessons finish the lowest school before starting a higher round', () => {
  const p = startSave(null).studyInfo
  p.chinese = 10
  p.mathematics = 9
  assert.equal(selectCareStudy(studies(p), p, 'balanced', 'chinese')?.id, 'xx-politics')
  for (const k of Object.keys(p) as (keyof StudyInfo)[]) p[k] = 9
  p.chinese = 10
  assert.equal(selectCareStudy(studies(p), p, 'balanced', 'chinese'), undefined, 'higher school must wait for the other exams')
  for (const k of Object.keys(p) as (keyof StudyInfo)[]) p[k] = 10
  assert.equal(selectCareStudy(studies(p), p, 'balanced', 'chinese')?.id, 'zx-chinese')
})

test('endless courses never block unfinished subjects and remain available after all graduate', () => {
  const p = startSave(null).studyInfo
  for (const k of Object.keys(p) as (keyof StudyInfo)[]) p[k] = 168
  p.chinese = 170
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'chinese')?.id, 'xwzj-chinese')
  assert.equal(selectCareStudy(studies(p), p, 'balanced', 'chinese')?.id, 'xwzj-mathematics')
  p.music = 0
  assert.equal(selectCareStudy(studies(p), p, 'focused', 'chinese')?.id, 'xx-music')
})

test('fixed jobs wait when unavailable, while automatic focus compares hourly income', () => {
  const stats = { intel: 100, charm: 100, strong: 100 }
  const jobs = ['bz', 'sys', 'jzs', 'spg'].map(id => good('work', id))
  assert.equal(selectCareWork(jobs, stats, 'focused', '')?.id, 'spg')
  assert.equal(selectCareWork(jobs, stats, 'focused', 'sys')?.id, 'sys')
  assert.equal(selectCareWork(jobs, stats, 'focused', 'unknown'), undefined)
  assert.equal(selectCareWork([{ ...jobs[0], useTime: 0 }], stats, 'focused', ''), undefined)
  assert.deepEqual(jobs.map(g => g.id), ['bz', 'sys', 'jzs', 'spg'], 'selection must not reorder the caller catalogue')
})

test('balanced jobs respond to the current weakest attributes, within eligible candidates', () => {
  const jobs = ['hj', 'yd', 'ba'].map(id => good('work', id))
  assert.equal(selectCareWork(jobs, { intel: 0, charm: 100, strong: 100 }, 'balanced', 'ba')?.id, 'yd')
  assert.equal(selectCareWork(jobs, { intel: 100, charm: 0, strong: 100 }, 'balanced', '')?.id, 'hj')
  assert.equal(selectCareWork(jobs, { intel: 100, charm: 100, strong: 0 }, 'balanced', '')?.id, 'ba')
  assert.equal(selectCareWork([], { intel: 0, charm: 0, strong: 0 }, 'balanced', ''), undefined)
})

test('old and invalid policies remain safe, and preferences survive save and import', () => {
  const old = startSave(null)
  old.havePet = true
  const raw = JSON.parse(JSON.stringify(old))
  for (const k of ['careTrainingMode', 'careStudySubject', 'careWorkId', 'careAutoFarm']) delete raw.settings[k]
  const restored = startSave(raw)
  assert.equal(restored.settings.careTrainingMode, 'focused')
  assert.equal(restored.settings.careStudySubject, 'chinese')
  assert.equal(restored.settings.careWorkId, '')
  assert.equal(restored.settings.careAutoFarm, false)
  applyPatch(restored, { settings: { careTrainingMode: 'balanced', careStudySubject: 'music', careWorkId: 'hj', careAutoFarm: true } })
  const imported = validatedImport(JSON.parse(JSON.stringify(restored)))
  assert.equal(imported.settings.careTrainingMode, 'balanced')
  assert.equal(imported.settings.careStudySubject, 'music')
  assert.equal(imported.settings.careWorkId, 'hj')
  assert.equal(imported.settings.careAutoFarm, true)
  Object.assign(raw.settings, { careTrainingMode: 'unknown', careStudySubject: '__proto__', careWorkId: '<script>', careAutoFarm: 'true' })
  const invalid = startSave(raw)
  assert.equal(invalid.settings.careTrainingMode, 'focused')
  assert.equal(invalid.settings.careStudySubject, 'chinese')
  assert.equal(invalid.settings.careWorkId, '')
  assert.equal(invalid.settings.careAutoFarm, false)
})
