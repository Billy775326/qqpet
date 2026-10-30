export interface PetRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PetMetrics {
  extent: number
  left: number
  top: number
  right: number
  bottom: number
}

/** CSS pixels from the visible standing silhouette to a snap edge. */
export const EDGE_SNAP = 20

// Alpha bounds of all bundled standing variants, measured at 512 by 512 pixels.
export const PET_SHAPES: Readonly<Record<string, readonly [number, number, number, number]>> = {
  'GG/Egg': [0.30078125, 0.39453125, 0.6875, 0.912109375],
  'GG/Kid': [0.265625, 0.4453125, 0.71875, 0.9140625],
  'GG/Adult/happy': [0.240234375, 0.4609375, 0.783203125, 0.9140625],
  'GG/Adult/peaceful': [0.275390625, 0.455078125, 0.73046875, 0.9140625],
  'GG/Adult/upset': [0.28125, 0.5, 0.71875, 0.927734375],
  'GG/Adult/sad': [0.2265625, 0.578125, 0.775390625, 0.9296875],
  'MM/Egg': [0.30078125, 0.39453125, 0.6875, 0.912109375],
  'MM/Kid': [0.26171875, 0.39453125, 0.72265625, 0.9140625],
  'MM/Adult/happy': [0.240234375, 0.37109375, 0.783203125, 0.912109375],
  'MM/Adult/peaceful': [0.2734375, 0.373046875, 0.73046875, 0.912109375],
  'MM/Adult/upset': [0.28125, 0.408203125, 0.71875, 0.927734375],
  'MM/Adult/sad': [0.2265625, 0.515625, 0.775390625, 0.9296875]
}

export function shapeMetrics(key: string, extent: number, dpr = 1): PetMetrics {
  const box = PET_SHAPES[key]
  const safe = 1 / dpr
  return { extent, left: Math.max(0, box[0] * extent - safe), top: Math.max(0, box[1] * extent - safe), right: Math.min(extent, box[2] * extent + safe), bottom: Math.min(extent, box[3] * extent + safe) }
}

export const axisMax = (limit: number, extent: number): number => Math.max(0, limit - extent)

export function clampAxis(value: number, limit: number, extent: number, low: number, high: number, snap = false): number {
  const max = axisMax(limit, extent)
  const clamped = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max))
  if (!snap || !max) return clamped
  const travel = Math.max(0, limit - (high - low))
  const start = clamped / max * travel, end = travel - start
  if (Math.min(start, end) > EDGE_SNAP) return clamped
  return start <= end ? 0 : max
}

/** Keep the existing nonnegative save coordinates while letting transparent margins leave the screen. */
export function axisToCanvas(value: number, limit: number, extent: number, low: number, high: number): number {
  const max = axisMax(limit, extent), travel = Math.max(0, limit - (high - low))
  return (max ? clampAxis(value, limit, extent, low, high) / max * travel : travel / 2) - low
}

export function axisFromCanvas(value: number, limit: number, extent: number, low: number, high: number): number {
  const travel = limit - (high - low)
  return travel > 0 ? (value + low) * axisMax(limit, extent) / travel : 0
}
