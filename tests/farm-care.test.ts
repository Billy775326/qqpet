import assert from 'node:assert/strict'
import test from 'node:test'
import { careFarm, hasFarmCare } from '../src/shared/farm-care.ts'

test('farm care clears only selected needs, awards native EXP, and preserves crops, inventory and money', () => {
  const user = {
    experience: '99', rank: '01', wealth: '500', weather: 'Sunny', custom: { keep: true },
    farmland: [
      { farmland: 'FarmlandG', crop: 'RadishSeed', time: 123, grass: 1, worm: 1, yield: 20 },
      { farmland: 'FarmlandG', crop: 'CarrotSeed', time: 1, state: 5, worm: 1 },
      { farmland: 'FarmlandS', crop: 'GrapeSeed', harvest: 'xx', grass: 1 },
      { farmland: 'Wasteland' },
    ], burden: [{ Items: 'Fertilizer', number: 2 }], warehouse: [{ fruit: 'RadishSeed', number: 5 }],
  }
  const before = JSON.stringify(user)
  const result = careFarm(user, new Set([0]))
  assert.equal(result.actions, 3)
  assert.equal(result.user.experience, 5)
  assert.equal(result.user.rank, 2)
  const fields = result.user.farmland as Record<string, unknown>[]
  assert.deepEqual(fields[0], { farmland: 'FarmlandS', crop: 'RadishSeed', time: 123, yield: 20 })
  assert.deepEqual(fields.slice(1), user.farmland.slice(1))
  for (const key of ['wealth', 'weather', 'burden', 'warehouse', 'custom']) assert.deepEqual(result.user[key], user[key as keyof typeof user])
  assert.equal(JSON.stringify(user), before, 'the caller snapshot is not mutated before persistence')
  const again = careFarm(result.user, new Set([0]))
  assert.equal(again.actions, 0)
  assert.equal(again.user.experience, 5, 'repeated ticks cannot farm experience from cleared needs')
})

test('farm care does not create a farm or repair malformed progress by discarding it', () => {
  for (const user of [{}, { farmland: [] }, { farmland: [{ grass: 1 }], rank: 0, experience: 0 }, { farmland: [{ grass: 1 }], rank: 1, experience: 'bad' }]) {
    const before = JSON.stringify(user)
    assert.equal(careFarm(user, new Set([0])).actions, 0)
    assert.equal(JSON.stringify(user), before)
  }
})

test('open-farm work detection ignores empty, ripe and harvested plots', () => {
  assert.equal(hasFarmCare({ farmland: [{ farmland: 'FarmlandG' }, { crop: 'RadishSeed', state: 5, worm: 1 }, { crop: 'RadishSeed', harvest: 'xx', grass: 1 }] }), false)
  assert.equal(hasFarmCare({ farmland: [{ crop: 'RadishSeed', state: 2, grass: 0 }] }), true)
  assert.equal(hasFarmCare({ farmland: [{ crop: 'RadishSeed', state: 2, grass: null, worm: null }] }), false)
})
