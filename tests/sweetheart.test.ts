import assert from 'node:assert/strict'
import test from 'node:test'
import { SWEETHEART_DAY_SECONDS as DAY, sweetHeartCapacity } from '../src/shared/sweetheart.ts'

const NOW = 1800000000

test('sweetheart renewal uses current expiry instead of the purchase selection', () => {
  assert.deepEqual(sweetHeartCapacity(0, NOW), { remainingDays: 0, availableDays: 30 })
  assert.deepEqual(sweetHeartCapacity(NOW + 10 * DAY, NOW), { remainingDays: 10, availableDays: 20 })
  assert.deepEqual(sweetHeartCapacity(NOW + 30 * DAY, NOW), { remainingDays: 30, availableDays: 0 })
})

test('partial remaining days cannot allow a whole-day renewal past the cap', () => {
  assert.deepEqual(sweetHeartCapacity(NOW + 10 * DAY + 1, NOW), { remainingDays: 11, availableDays: 19 })
  assert.deepEqual(sweetHeartCapacity(NOW + 29.5 * DAY, NOW), { remainingDays: 30, availableDays: 0 })
  assert.deepEqual(sweetHeartCapacity(NOW + 1, NOW), { remainingDays: 1, availableDays: 29 })
})

test('expired and legacy over-cap bookings retain their data while limiting new purchases', () => {
  assert.deepEqual(sweetHeartCapacity(NOW - DAY, NOW), { remainingDays: 0, availableDays: 30 })
  assert.deepEqual(sweetHeartCapacity(NOW + 60 * DAY, NOW), { remainingDays: 60, availableDays: 0 })
  const expiry = NOW + 30 * DAY
  assert.equal(sweetHeartCapacity(expiry, NOW + DAY).availableDays, 1)
})
