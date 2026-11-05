import { allGoods, type Good } from './data/goods'
import SHOP from './data/shop.json'
import { listGoods } from './goods'
import { buy, price, useItem } from './items'
import { info, save } from './store'

const soldFoods = new Set(Object.values(SHOP).flatMap(tab => 'food' in tab ? tab.food.flat() : []))
const ownedFood = (): Good[] => listGoods('food', 1, Number.MAX_SAFE_INTEGER).list.filter(g => g.num > 0 && (g.hunger ?? 0) > 0)
const sold = (g: Good): boolean => soldFoods.has(g.id) && !g.outOfPrint && Number.isFinite(g.price) && g.price! >= 0

/** Purchase eligibility; owned foods remain usable under the usual item rules. */
export function canBuyCareFood(g: Good): boolean {
  return sold(g) && (g.needLevel ?? 0) <= save.petComputedlInfo.level && (!g.PD || info.pinkDiamond)
}

/** Food choices include usable stock and shop foods, including locked choices. */
export function careFoods(): Good[] {
  const owned = new Map(ownedFood().map(g => [g.id, g.num]))
  return allGoods('food')
    .filter(g => (g.hunger ?? 0) > 0 && (owned.has(g.id) || sold(g)))
    .map(g => ({ ...g, num: owned.get(g.id) ?? 0 }))
    .sort((a, b) => Number(b.num > 0) - Number(a.num > 0))
}

function feedingFood(): Good | undefined {
  const selected = save.settings.careFoodId ?? ''
  const owned = ownedFood().find(g => !selected || g.id === selected)
  if (owned || !save.settings.careAutoBuy) return owned
  const candidate = careFoods()
    .filter(g => (!selected || g.id === selected) && canBuyCareFood(g) && price(g) <= info.yb)
    .sort((a, b) => price(a) - price(b))[0]
  // Precheck funds so an unattended pet does not repeatedly open shortage alerts.
  return candidate && buy(candidate, 1, true) ? { ...candidate, num: 1 } : undefined
}

/** At most one item per growth tick; food settings do not change cleaning/play thresholds. */
export function selfCare(): void {
  if (!info.sweetHeart || info.sweetHeartOverTime <= Date.now() / 1000 || save.settings.paused || info.health <= 0) return
  const needs = [
    { stat: 'hunger', type: 'food', act: '吃东西', threshold: (save.settings.careHungerPercent ?? 60) / 100 },
    { stat: 'clean', type: 'clean', act: '洗白白', threshold: 0.6 },
    { stat: 'mood', type: 'toy', act: '玩玩具', threshold: 0.6 },
  ] as const
  for (const need of needs) {
    if (info[need.stat] / save.petComputedlInfo[`${need.stat}Max`] >= need.threshold) continue
    const g = need.type === 'food' ? feedingFood() : listGoods(need.type, 1, 1).list[0]
    if (!g) continue
    useItem(g, false, `[host]，我可以自己${need.act}哦！~~使用了：${g.name}`)
    return
  }
}
