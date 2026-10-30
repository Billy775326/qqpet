import assert from 'node:assert/strict'
import test from 'node:test'
import { PET_SHAPES, axisMax, axisToCanvas, axisFromCanvas, clampAxis, shapeMetrics } from '../src/shared/pet-geometry.ts'

test('all pet silhouettes reach each work-area edge without changing the save coordinate range', () => {
  let cases = 0
  for (const key of Object.keys(PET_SHAPES)) for (const limit of [320, 560, 1040, 1920]) for (const extent of [96, 146]) for (const dpr of [1, 1.5]) {
    const m = shapeMetrics(key, extent, dpr), max = axisMax(limit, extent)
    for (const [low, high] of [[m.left, m.right], [m.top, m.bottom]]) {
      const start = axisToCanvas(0, limit, extent, low, high)
      const end = axisToCanvas(max, limit, extent, low, high)
      assert.ok(Math.abs(start + low) < 1e-8)
      assert.ok(Math.abs(end + high - limit) < 1e-8)
      for (const value of [0, max / 2, max]) assert.ok(Math.abs(axisFromCanvas(axisToCanvas(value, limit, extent, low, high), limit, extent, low, high) - value) < 1e-8)
      assert.equal(clampAxis(-100, limit, extent, low, high), 0)
      assert.equal(clampAxis(Infinity, limit, extent, low, high), 0)
      assert.equal(clampAxis(max + 100, limit, extent, low, high), max)
      cases++
    }
  }
  assert.equal(cases, 384)
})

test('snapping uses visible pixels, and pulling past the threshold immediately releases an edge', () => {
  const limit = 800, extent = 146, low = 40, high = 105
  const logical = (distance: number) => axisFromCanvas(distance - low, limit, extent, low, high)
  assert.equal(clampAxis(logical(19), limit, extent, low, high, true), 0)
  assert.ok(clampAxis(logical(21), limit, extent, low, high, true) > 0)
  assert.equal(clampAxis(axisMax(limit, extent) - logical(19), limit, extent, low, high, true), axisMax(limit, extent))
  assert.equal(clampAxis(100, 40, extent, low, high, true), 0)
  assert.equal(axisFromCanvas(100, 40, extent, low, high), 0)
})
