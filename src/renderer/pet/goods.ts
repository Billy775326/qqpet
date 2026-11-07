import { goodOf, type Good, type GoodType, type TimedType } from './data/goods'
import { inventoryCount, inventoryPatch } from './inventory'
import { commit, save, update } from './store'

type Listener = (type: GoodType) => void
const listeners: Listener[] = []
/** Inventory or timed goods of `type` changed. */
export const onGoodsChange = (l: Listener): void => void listeners.push(l)
const changed = (type: GoodType): void => listeners.forEach((l) => l(type))

/** Notify inventory views after a successful multi-group commit. */
export const goodsCommitted = (types: readonly GoodType[]): void => [...new Set(types)].forEach(changed)

export const quantityOf = (type: GoodType, id: string): number => inventoryCount(save.selfGoodDatas[type], id)

export interface Page {
  list: Good[]
  /** 0 when empty. */
  totalPage: number
}

export const pageOf = (all: Good[], page: number, size: number): Page => ({
  list: all.slice((page - 1) * size, page * size),
  totalPage: Math.ceil(all.length / size),
})

/** One page of the inventory. */
export function listGoods(type: GoodType, page: number, size: number): Page {
  const all = save.selfGoodDatas[type].map((e) => {
    const [id, n] = e.slice(1).split('*')
    return goodOf(type, id, +n)
  })
  return pageOf(all, page, size)
}

export const hasGood = (type: GoodType, id: string): boolean => quantityOf(type, id) > 0

/** Adds (or with a negative n removes) n of a good; also records it as seen. */
export function addGood(type: GoodType, id: string, n: number): void {
  commit(inventoryPatch(save, [{ type, id, num: n }]))
  changed(type)
}

/** Reject invalid or stale quantities before deducting; never partially consume. */
export function takeGood(good: Good, n = 1): boolean {
  if (!Number.isSafeInteger(n) || n <= 0 || quantityOf(good.type, good.id) < n) return false
  addGood(good.type, good.id, -n)
  return true
}

/** Puts a timed good in effect for its full duration, replacing the previous one of its type. */
export function startTimed(good: Good & { type: TimedType }): void {
  update('selfGoodUseOption', { [good.type]: { id: good.id, left: good.useTimeing! } })
  changed(good.type)
}

/** Counts the timed goods down; returns the types that ran out. */
export function tickTimed(minutes: number): TimedType[] {
  const over: TimedType[] = []
  for (const [type, t] of Object.entries(save.selfGoodUseOption) as [TimedType, { id: string; left: number } | null][]) {
    if (!t) continue
    const left = t.left - minutes
    update('selfGoodUseOption', { [type]: left > 0 ? { id: t.id, left } : null })
    if (left <= 0) over.push(type)
    changed(type)
  }
  return over
}
