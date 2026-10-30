import assert from 'node:assert/strict'
import test from 'node:test'
import { RECHARGE_TIERS, rechargedBalance } from '../src/shared/recharge.ts'

test('only the six local recharge tiers credit currency at 1:10', () => {
  assert.deepEqual(RECHARGE_TIERS, [6, 30, 98, 198, 328, 648])
  for (const [tier, gain] of [[6, 60], [30, 300], [98, 980], [198, 1980], [328, 3280], [648, 6480]]) assert.equal(rechargedBalance(5000, tier), 5000 + gain)
  for (const tier of [-6, 0, 6.5, 7, 1000, NaN, Infinity]) assert.equal(rechargedBalance(5000, tier), null)
})

test('recharge cannot overflow the save integer or accept a corrupt balance', () => {
  assert.equal(rechargedBalance(2147483647 - 60, 6), 2147483647)
  for (const previous of [2147483647 - 59, 2147483648, -2147483649, NaN, Infinity, 0.5]) assert.equal(rechargedBalance(previous, 6), null)
  assert.equal(rechargedBalance(-2147483648, 6), -2147483588)
})
