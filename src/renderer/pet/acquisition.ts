import { INITIAL_GOODS } from '../../shared/save-logic'
import { allGoods, type Good } from './data/goods'
import POOLS from './data/pool.json'
import SHOP from './data/shop.json'
import { TASKS } from './data/task-definitions'
import { MILESTONES } from './milestones'

export interface AcquisitionSource {
  /** Stable source identity, independent of whether this save has claimed it. */
  key: string
  repeatable: boolean
}
export type Availability = 'repeatable' | 'rare' | 'limited' | 'discontinued'

/** Legacy sale flags, price, current inventory and imports do not define rarity. */
export function classifySources(sources: readonly AcquisitionSource[]): Availability {
  if (sources.some(source => source.repeatable)) return 'repeatable'
  const opportunities = new Set(sources.map(source => source.key)).size
  if (!opportunities) return 'discontinued'
  // Several distinct lifetime goals are several opportunities, not just one.
  return opportunities === 1 ? 'rare' : 'limited'
}

const sources = new Map<string, AcquisitionSource[]>()
const add = (code: string, key: string, repeatable: boolean): void => {
  const id = code.replace(/^_/, '').split('*')[0]
  const list = sources.get(id) ?? []
  if (!list.some(source => source.key === key)) list.push({ key, repeatable })
  sources.set(id, list)
}
// Random pools are reachable repeatedly through sign-in, online gifts and travel.
POOLS.forEach((pool, i) => pool.forEach(code => add(code, `loot:${i}`, true)))
for (const [tab, types] of Object.entries(SHOP))
  for (const pages of Object.values(types))
    for (const id of pages.flat()) add(id, `shop:${tab}`, true)
// mail.ts: annual birthday/holiday mail draws from all food and toy definitions.
for (const type of ['food', 'toy'] as const)
  for (const g of allGoods(type)) add(g.id, 'calendar-mail', true)
add('yb', 'calendar-mail', true)
add('growth', 'daily-growth-draw', true)
// City goals reset after a completed tour, so `keep` does not mean once per save.
for (const [tab, tasks] of Object.entries(TASKS))
  tasks.forEach((task, i) => task.good?.forEach(code => add(code, `task:${tab}:${i}`, true)))
for (const task of MILESTONES)
  for (const code of task.good) add(code, `milestone:${task.id}`, false)
for (const [type, goods] of Object.entries(INITIAL_GOODS))
  for (const code of goods) add(code, `initial:${type}`, false)

/** Normal gameplay only: deliberately exclude full-item mail, imports and edited saves. */
export const acquisitionSources = (g: Pick<Good, 'id'>): readonly AcquisitionSource[] => sources.get(g.id) ?? []
export const availability = (g: Pick<Good, 'id'>): Availability => classifySources(acquisitionSources(g))
export const needsUseConfirmation = (g: Pick<Good, 'id'>): boolean => availability(g) !== 'repeatable'

/** Kept short enough for the original alert skin, including its quantity controls. */
export function useWarning(g: Good, n: number, owned: number): string {
  const kind = availability(g)
  const label = kind === 'rare' ? '稀有' : kind === 'limited' ? '限量' : '绝版'
  const reason = kind === 'rare' ? '整个存档仅有一次正常获取机会。' : kind === 'limited' ? '仅有有限的获取机会，无法重复获得。' : '暂无正常获取途径。'
  return `${g.name}（${label}）\n${reason}\n将消耗 ${n} 份 / 背包 ${owned} 份，确定吗？`
}
