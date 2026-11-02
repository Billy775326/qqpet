export const RECHARGE_TIERS = Object.freeze([6, 30, 98, 198, 328, 648] as const)
export const RECHARGE_RATE = 10
export const RECHARGE_BOOST_RATE = 100
export const RECHARGE_BOOST_CLICKS = 10
// Save normalization stores currency as a signed 32-bit integer.
const MIN_BALANCE = -2147483648
const MAX_BALANCE = 2147483647

export function rechargedBalance(previous: number, tier: number, rate: number = RECHARGE_RATE): number | null {
  if ((rate !== RECHARGE_RATE && rate !== RECHARGE_BOOST_RATE) || !RECHARGE_TIERS.some(value => value === tier) || !Number.isSafeInteger(previous) || previous < MIN_BALANCE || previous > MAX_BALANCE) return null
  const next = previous + tier * rate
  return next <= MAX_BALANCE ? next : null
}
