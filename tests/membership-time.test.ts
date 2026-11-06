import assert from 'node:assert/strict'
import test from 'node:test'
import { remainingTime } from '../src/renderer/ui/date.ts'

test('membership countdown uses exact expiry seconds across day and sub-second boundaries', () => {
  assert.equal(remainingTime(1000 + 2 * 86400 + 3 * 3600 + 4 * 60 + 5, 1000), '2天 03小时04分05秒')
  assert.equal(remainingTime(1001, 1000), '0天 00小时00分01秒')
  assert.equal(remainingTime(1000.1, 1000), '0天 00小时00分01秒')
  assert.equal(remainingTime(87400, 1000), '1天 00小时00分00秒')
  assert.equal(remainingTime(87400, 1001), '0天 23小时59分59秒')
  assert.equal(remainingTime(1000, 1000), '已到期')
  assert.equal(remainingTime(999, 1000), '已到期')
  assert.equal(remainingTime(0, 1000), '未开通')
  assert.equal(remainingTime(NaN, 1000), '未开通')
})
