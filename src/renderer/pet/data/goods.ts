import type { SelfGoodDatas, SelfGoodUseOption, StudyInfo } from '../../../shared/save'
import GOODS from './goods.json'
import { rarityOf, RARITY_NAMES } from './rarity'

export type GoodType = keyof SelfGoodDatas
/** Goods that stay in effect for a while (`useTimeing` minutes). */
export type TimedType = keyof SelfGoodUseOption

export interface Good {
  id: string
  name: string
  type: GoodType
  url: string
  desc?: string
  /** 元宝; -1 is not for sale. */
  price?: number
  needLevel?: number
  /** Pink diamond members only. */
  PD?: boolean
  /** No longer sold; only won. */
  outOfPrint?: boolean
  hunger?: number
  clean?: number
  mood?: number
  intel?: number
  charm?: number
  strong?: number
  /** Extra growth per hour while in effect. */
  group?: number
  /** Minutes the good stays in effect. */
  useTimeing?: number
  /** nums: amount added to petInfo[useId ?? id] per unit. */
  value?: number
  useId?: string
  /** Work and study: minutes it takes. */
  useTime?: number
  /** Work: 元宝 earned, and the levels and stats it requires. */
  yb?: number
  education?: Partial<StudyInfo>
  useArtt?: Partial<Record<'charm' | 'intel' | 'strong', number>>
  /** Study: subject name, lessons before the exam and the studyInfo value the school starts at. */
  object?: string
  tolkName?: string
  classNum?: number
  classNumUp?: number
  /** Count owned (inventory) or 1. */
  num: number
}

const MINUTES_PER_DAY = 24 * 60
// Background catalogue values are days. Normalize once so active effects and
// existing save files continue using minutes, like the other timed goods.
const TABLE = {
  ...GOODS,
  background: Object.fromEntries(Object.entries(GOODS.background).map(([key, g]) => [key, {
    ...g,
    useTimeing: g.id === 'b0000000' ? g.useTimeing : g.useTimeing * MINUTES_PER_DAY,
  }])),
} as unknown as Record<GoodType, Record<string, Omit<Good, 'num'>>>

export const goodOf = (type: GoodType, id: string, num = 1): Good => ({
  ...TABLE[type][`_${id}`],
  num,
})

/** Every good of a type, in table order. */
export const allGoods = (type: GoodType): Good[] => Object.values(TABLE[type]).map((g) => ({ ...g, num: 1 }))

/** A good by id alone; ids are unique across types. */
export function findGood(id: string): Good {
  const type = (Object.keys(TABLE) as GoodType[]).find((t) => TABLE[t][`_${id}`])!
  return goodOf(type, id)
}

/** A good from its `_<id>*<count>` code (count defaults to 1). */
export function parseGood(code: string): Good {
  const [id, n] = code.slice(1).split('*')
  return { ...findGood(id), num: +(n ?? 1) }
}

/** " 魅力+1 智力+2"-style attribute gains, or ''. */
export const attrs = (g: Good): string =>
  (
    [
      ['魅力', g.charm],
      ['智力', g.intel],
      ['武力', g.strong],
      ['心情', g.mood],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([k, v]) => ` ${k}+${v}`)
    .join('')

/** Backgrounds use whole remaining days; other effects keep their minute units. */
export function durationText(g: Good, minutes = g.useTimeing): string {
  if (!minutes || minutes <= 0 || g.type === 'background' && g.id === 'b0000000') return ''
  return g.type === 'background' ? `${Math.ceil(minutes / MINUTES_PER_DAY)}天` : `${minutes}分钟`
}

/** Tooltip lines of a good, as in the original's item panels. */
export function describe(g: Good): string[] {
  const classification = ['food', 'clean', 'medicine', 'toy', 'background', 'nums'].includes(g.type) && g.id !== 'b0000000' ? `分类：${RARITY_NAMES[rarityOf(g)]}` : ''
  if (g.type === 'nums') return [`获得${g.name}*${g.value}`, g.desc ?? '', classification].filter(Boolean)
  const a = attrs(g)
  const duration = durationText(g)
  const lines = [
    classification,
    g.desc,
    g.hunger && `饥饿：${g.hunger}`,
    g.clean && `清洁：${g.clean}`,
    a && `属性：${a}`,
    g.group && `成长值：${g.group}`,
    duration && `持续时间：${duration}`,
  ]
  return lines.filter((l): l is string => Boolean(l))
}

export const TYPE_NAMES: Record<GoodType, string> = {
  food: '食物',
  clean: '日用品',
  medicine: '药品',
  toy: '玩具',
  nums: '功能',
  background: '背景',
  service: '服务',
  work: '工作',
  study: '学习',
  trip: '学习',
}
