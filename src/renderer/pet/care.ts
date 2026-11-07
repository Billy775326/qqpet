import { allGoods, type Good } from './data/goods'
import { needsUseConfirmation } from './acquisition'
import SHOP from './data/shop.json'
import { listGoods } from './goods'
import { buy, price, useCareItem } from './items'
import { info, save } from './store'

export const CARE_NEEDS = [
  { stat: 'hunger', type: 'food', label: '喂食', statLabel: '饥饿', itemLabel: '食物', act: '吃东西', percent: 'careHungerPercent', item: 'careFoodId' },
  { stat: 'clean', type: 'clean', label: '清洁', statLabel: '清洁', itemLabel: '清洁用品', act: '洗白白', percent: 'careCleanPercent', item: 'careCleanId' },
  { stat: 'mood', type: 'toy', label: '玩耍', statLabel: '心情', itemLabel: '玩具', act: '玩玩具', percent: 'careMoodPercent', item: 'careToyId' },
] as const
export type CareNeed = typeof CARE_NEEDS[number]
type CareType = CareNeed['type']
const soldItems = Object.fromEntries(CARE_NEEDS.map(({ type }) => [type, new Set(Object.values(SHOP).flatMap(tab => (tab as Partial<Record<CareType, string[][]>>)[type]?.flat() ?? []))])) as Record<CareType, Set<string>>
const ownedGoods = (need: CareNeed): Good[] => listGoods(need.type, 1, Number.MAX_SAFE_INTEGER).list.filter(g => g.num > 0 && (g[need.stat] ?? 0) > 0)
const sold = (g: Good): boolean => soldItems[g.type as CareType]?.has(g.id) === true && !g.outOfPrint && Number.isFinite(g.price) && g.price! >= 0

/** Purchase eligibility; owned supplies remain usable under the usual item rules. */
export function canBuyCareGood(g: Good): boolean {
  return sold(g) && (g.needLevel ?? 0) <= save.petComputedlInfo.level && (!g.PD || info.pinkDiamond)
}

/** Choices include usable stock and shop items, including locked choices. */
export function careGoods(need: CareNeed): Good[] {
  const owned = new Map(ownedGoods(need).map(g => [g.id, g.num]))
  return allGoods(need.type)
    .filter(g => (g[need.stat] ?? 0) > 0 && (owned.has(g.id) || sold(g)))
    .map(g => ({ ...g, num: owned.get(g.id) ?? 0 }))
    .sort((a, b) => Number(b.num > 0) - Number(a.num > 0))
}

function careItem(need: CareNeed): Good | undefined {
  const selected = save.settings[need.item] ?? ''
  const owned = ownedGoods(need).find(g => !needsUseConfirmation(g) && (!selected || g.id === selected))
  if (owned || !save.settings.careAutoBuy) return owned
  const candidate = careGoods(need)
    .filter(g => !needsUseConfirmation(g) && (!selected || g.id === selected) && canBuyCareGood(g) && price(g) <= info.yb)
    .sort((a, b) => price(a) - price(b))[0]
  // Precheck funds so an unattended pet does not repeatedly open shortage alerts.
  return candidate && buy(candidate, 1, true) ? { ...candidate, num: 1 } : undefined
}

/** Every automatic caller shares the same trigger limit before using or buying supplies. */
export function performCare(need: CareNeed): boolean {
  if (info[need.stat] / save.petComputedlInfo[`${need.stat}Max`] >= (save.settings[need.percent] ?? 60) / 100) return false
  const g = careItem(need)
  if (!g) return false
  return useCareItem(g, `[host]，我可以自己${need.act}哦！~~使用了：${g.name}`)
}

/** At most one item per growth tick; each need has its own threshold and item preference. */
export function selfCare(): boolean {
  if (!info.sweetHeart || info.sweetHeartOverTime <= Date.now() / 1000 || save.settings.paused || info.health <= 0) return false
  for (const need of CARE_NEEDS) {
    if (performCare(need)) return true
  }
  return false
}
