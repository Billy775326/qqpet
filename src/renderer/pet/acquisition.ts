import type { Good } from './data/goods'
import { isProtectedItem, rarityOf, RARITY_NAMES } from './data/rarity'

export { rarityOf as availability, isProtectedItem } from './data/rarity'

/** Confirm only when a manual use would exhaust a protected item's live stock. */
export function needsUseConfirmation(g: { id: string }, owned = 1, n = 1): boolean {
  return isProtectedItem(g) && owned > 0 && n >= owned
}

/** Short enough for the original alert skin and its quantity controls. */
export function useWarning(g: Good, n: number, owned: number): string {
  const kind = rarityOf(g)
  const reason = kind === 'discontinued' ? '原活动获取入口在当前版本未提供。' : '获取不易，建议保留一份收藏。'
  return `${g.name}（${RARITY_NAMES[kind]}）\n${reason}\n使用 ${n} 份，将用尽背包 ${owned} 份。`
}
