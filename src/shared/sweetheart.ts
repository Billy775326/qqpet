export const SWEETHEART_DAY_SECONDS = 86400
export const SWEETHEART_MAX_DAYS = 30
export const SWEETHEART_DAILY_PRICE = 300

/** Whole days that can be bought without pushing the actual remaining period past 30 days. */
export function sweetHeartCapacity(expiresAt: number, now = Date.now() / 1000): { remainingDays: number; availableDays: number } {
  const remainingDays = Math.max(0, Math.ceil((expiresAt - now) / SWEETHEART_DAY_SECONDS))
  return { remainingDays, availableDays: Math.max(0, SWEETHEART_MAX_DAYS - remainingDays) }
}
