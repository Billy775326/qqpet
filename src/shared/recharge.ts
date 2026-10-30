export const RECHARGE_TIERS = Object.freeze([6, 30, 98, 198, 328, 648] as const)
export const RECHARGE_RATE = 10
// Save normalization stores currency as a signed 32-bit integer.
const MIN_BALANCE = -2147483648
const MAX_BALANCE = 2147483647

export function rechargedBalance(previous: number, tier: number): number | null {
  if (!RECHARGE_TIERS.some(value => value === tier) || !Number.isSafeInteger(previous) || previous < MIN_BALANCE || previous > MAX_BALANCE) return null
  const next = previous + tier * RECHARGE_RATE
  return next <= MAX_BALANCE ? next : null
}
