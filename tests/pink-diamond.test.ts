import assert from 'node:assert/strict'
import test from 'node:test'
import { pinkDiamondOffer } from '../src/shared/pink-diamond.ts'

const NOW = 1800000000

test('pink diamond retains the existing five-day introductory pack', () => {
  assert.deepEqual(pinkDiamondOffer(0, 1, 0, NOW), { days: 5, price: 666, first: true, active: false })
})

test('active renewals use level pricing even before the first daily growth settlement', () => {
  assert.deepEqual(pinkDiamondOffer(0, 1, NOW + 86400, NOW), { days: 5, price: 888, first: false, active: true })
  assert.equal(pinkDiamondOffer(300, 3, NOW + 86400, NOW).price, 2664)
})

test('expired bookings keep level pricing and cannot produce a free zero-level pack', () => {
  assert.equal(pinkDiamondOffer(100, 2, NOW - 1, NOW).price, 1776)
  assert.equal(pinkDiamondOffer(100, 0, 0, NOW).price, 888)
})
