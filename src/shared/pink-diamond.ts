export const PINK_DIAMOND_DAYS = 5

/** Keep the existing five-day pack and introductory/level-based prices. */
export function pinkDiamondOffer(growth: number, level: number, expiresAt: number, now = Date.now() / 1000): { days: number; price: number; first: boolean; active: boolean } {
  const active = expiresAt > now
  const first = !active && growth === 0
  return { days: PINK_DIAMOND_DAYS, price: first ? 666 : Math.max(1, level) * 888, first, active }
}
