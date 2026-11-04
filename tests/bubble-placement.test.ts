import assert from 'node:assert/strict'
import test from 'node:test'
import { bubblePosition } from '../src/shared/bubble-placement.ts'

const overlap = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

test('speech avoids a bar and expanded flyout when its preferred position is blocked', () => {
  const body = { left: 340, top: 220, right: 460, bottom: 350 }
  const controls = [{ left: 300, top: 176, right: 500, bottom: 208 }, { left: 330, top: 50, right: 438, bottom: 174 }]
  const p = bubblePosition(body, controls, 800, 560, 44)
  const bubble = { ...p, right: p.left + 261 * p.scale, bottom: p.top + 183 * p.scale }
  assert.ok(bubble.left >= 0 && bubble.top >= 0 && bubble.right <= 800 && bubble.bottom <= 560)
  for (const r of [body, ...controls]) assert.equal(overlap(bubble, r), 0)
})

test('speech stays inside tiny and fractional viewports and follows moved obstacles', () => {
  for (const [width, height] of [[320, 480], [200, 120], [853.5, 479.5]]) {
    const body = { left: width / 2, top: height / 2, right: width * .75, bottom: height * .8 }
    const p = bubblePosition(body, [], width, height)
    assert.ok(p.left >= 0 && p.top >= 0)
    assert.ok(p.left + 261 * p.scale <= width + .001 && p.top + 183 * p.scale <= height + .001)
  }
  const body = { left: 340, top: 300, right: 460, bottom: 430 }
  const free = bubblePosition(body, [], 800, 560)
  const blocked = bubblePosition(body, [{ left: free.left, top: free.top, right: free.left + 261, bottom: free.top + 183 }], 800, 560)
  assert.notDeepEqual(blocked, free)
  assert.deepEqual(bubblePosition(body, [], 800, 560), free)
})
