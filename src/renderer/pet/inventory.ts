import type { SaveData, SavePatch, SelfGoodDatas } from '../../shared/save'

export interface InventoryChange {
  type: keyof SelfGoodDatas
  id: string
  /** Signed safe integer; negative quantities must be fully available. */
  num: number
}

/** Read the full current count, including duplicate entries in legacy inventories. */
export function inventoryCount(list: string[], id: string): number {
  let count = 0
  for (const entry of list) {
    if (!entry.startsWith(`_${id}*`)) continue
    const quantity = Number(entry.slice(id.length + 2))
    if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(count + quantity)) throw new Error('物品库存数量无效')
    count += quantity
  }
  return count
}

/** Build a complete inventory change without touching state, including unknown legacy entries. */
export function inventoryPatch(save: Pick<SaveData, 'selfGoodDatas' | 'illustrated'>, changes: readonly InventoryChange[]): SavePatch {
  if (!changes.length) return {}
  const groups: Partial<SelfGoodDatas> = {}
  const illustrated = [...save.illustrated]
  for (const { type, id, num } of changes) {
    if (!Object.hasOwn(save.selfGoodDatas, type) || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !Number.isSafeInteger(num) || num === 0)
      throw new Error('物品数量或类型无效')
    const list = groups[type] ?? save.selfGoodDatas[type]
    const count = inventoryCount(list, id) + num
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('物品库存不足或数量超出范围')
    const first = list.findIndex(entry => entry.startsWith(`_${id}*`))
    // Preserve unrelated entries and order; consolidate duplicate records only for this ID.
    groups[type] = list.flatMap((entry, index) => !entry.startsWith(`_${id}*`) ? [entry] : index === first && count > 0 ? [`_${id}*${count}`] : [])
    if (first < 0 && count > 0) groups[type]!.push(`_${id}*${count}`)
    if (num > 0 && !illustrated.includes(id)) illustrated.push(id)
  }
  return { selfGoodDatas: groups, ...(illustrated.length !== save.illustrated.length ? { illustrated } : {}) }
}
