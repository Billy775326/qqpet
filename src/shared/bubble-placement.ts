import type { PetRect } from './pet-geometry'

type Bounds = Pick<PetRect, 'left' | 'top' | 'right' | 'bottom'>
const WIDTH = 261
const HEIGHT = 183
const GAP = 6

/** CSS-pixel bounds: prefer speech near the pet, then free space around visible controls. */
export function bubblePosition(body: Bounds, controls: readonly Bounds[], width: number, height: number, lift = 0): { left: number; top: number; scale: number } {
  const scale = Math.min(1, Math.max(1, width) / WIDTH, Math.max(1, height) / HEIGHT)
  const w = WIDTH * scale, h = HEIGHT * scale
  const clampX = (x: number): number => Math.max(0, Math.min(x, width - w))
  const clampY = (y: number): number => Math.max(0, Math.min(y, height - h))
  const preferred = { left: clampX((body.left + body.right - w) / 2), top: clampY(body.top < h ? body.bottom : body.top - h - lift) }
  const occupied = [body, ...controls]
  const xs = [preferred.left, 0, width - w, ...occupied.flatMap(r => [r.left - w - GAP, r.right + GAP])].map(clampX)
  const ys = [preferred.top, 0, height - h, ...occupied.flatMap(r => [r.top - h - GAP, r.bottom + GAP])].map(clampY)
  let best = preferred, bestOverlap = Infinity, bestDistance = Infinity
  for (const left of new Set(xs)) for (const top of new Set(ys)) {
    const overlap = occupied.reduce((sum, r) => {
      const horizontal = Math.max(0, Math.min(left + w, r.right + GAP) - Math.max(left, r.left - GAP))
      const vertical = Math.max(0, Math.min(top + h, r.bottom + GAP) - Math.max(top, r.top - GAP))
      return sum + horizontal * vertical
    }, 0)
    const distance = (left - preferred.left) ** 2 + (top - preferred.top) ** 2
    if (overlap < bestOverlap || overlap === bestOverlap && distance < bestDistance) {
      best = { left, top }; bestOverlap = overlap; bestDistance = distance
    }
  }
  return { ...best, scale }
}
