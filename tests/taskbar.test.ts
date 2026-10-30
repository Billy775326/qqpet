import assert from 'node:assert/strict'
import test from 'node:test'
import { hasBottomTaskbar } from '../src/shared/taskbar.ts'

test('bottom taskbar detection respects work-area offsets and other taskbar positions', () => {
  const bounds = { x: -1920, y: -1080, width: 1920, height: 1080 }
  assert.equal(hasBottomTaskbar(bounds, { ...bounds, height: 1040 }), true)
  assert.equal(hasBottomTaskbar(bounds, { ...bounds, height: 1078 }), true)
  assert.equal(hasBottomTaskbar(bounds, bounds), false)
  assert.equal(hasBottomTaskbar(bounds, { ...bounds, x: -1880, width: 1880 }), false)
  assert.equal(hasBottomTaskbar(bounds, { ...bounds, y: -1040, height: 1040 }), false)
})
