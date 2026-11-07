type RecordValue = Record<string, unknown>
const record = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v)
const CARE_EXP = 2
const EXP_PER_RANK = 100

/** Same pending work as FarmlandControl.water/weed/kill, without touching crop state. */
export function hasFarmCare(user: unknown): boolean {
  return record(user) && Array.isArray(user.farmland) && user.farmland.some(land =>
    record(land) && land.crop && land.harvest == null && Number(land.state ?? 0) < 5
    && (land.farmland === 'FarmlandG' || land.grass != null || land.worm != null),
  )
}

/** Mirror the movie's +2 EXP and one rank check per action; preserve unrelated save fields. */
export function careFarm(user: RecordValue, plots: ReadonlySet<number>): { user: RecordValue; actions: number } {
  let experience = Number(user.experience), rank = Number(user.rank)
  if (!Array.isArray(user.farmland) || !Number.isFinite(experience) || experience < 0 || !Number.isInteger(rank) || rank < 1)
    return { user, actions: 0 }
  let actions = 0
  const reward = (): void => {
    actions++
    experience = Math.trunc(experience) + CARE_EXP
    if (experience >= rank * EXP_PER_RANK) { experience -= rank * EXP_PER_RANK; rank++ }
  }
  const farmland = user.farmland.map((value, index) => {
    if (!plots.has(index) || !record(value)) return value
    const land = { ...value }
    if (land.farmland === 'FarmlandG') { land.farmland = 'FarmlandS'; reward() }
    if (land.grass != null) { delete land.grass; reward() }
    if (land.worm != null) { delete land.worm; reward() }
    return land
  })
  return actions ? { user: { ...user, farmland, experience, rank: rank === Number(user.rank) ? user.rank : rank }, actions } : { user, actions }
}
