import CATALOGUE from './rarity.json'

export type Rarity = 'common' | 'collectible' | 'rare' | 'discontinued'
export const RARITIES: readonly Rarity[] = ['common', 'collectible', 'rare', 'discontinued']
export const RARITY_NAMES: Record<Rarity, string> = { common: '普通', collectible: '珍藏', rare: '稀有', discontinued: '绝版' }
export const RARITY_GROUPS: Record<Rarity, string> = { ...RARITY_NAMES, discontinued: '历史藏品／绝版' }
const byId = new Map(RARITIES.flatMap(kind => CATALOGUE.classes[kind].map(id => [id, kind] as const)))

/** Reviewed item IDs, never inferred from keywords, stock, imports or old sale flags. */
export const rarityOf = (g: { id: string }): Rarity => byId.get(g.id) ?? 'common'
export const isProtectedItem = (g: { id: string }): boolean => ['rare', 'discontinued'].includes(rarityOf(g))
