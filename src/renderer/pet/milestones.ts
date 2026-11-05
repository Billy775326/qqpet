import type { SaveData } from '../../shared/save'

export type LifetimeCounter = 'Eat' | 'Clean' | 'Toy' | 'Amusing' | 'Study' | 'Work' | 'Travel1' | 'GameRound' | 'Game'
type Metric = LifetimeCounter | 'care' | 'level' | 'primary' | 'middle' | 'university' | 'postgraduate' | 'provinces' | 'collection' | 'fish' | 'farm' | 'online'
export type MilestoneTab = 'milestones' | 'ddw' | 'growth'

interface Milestone {
  /** Permanent save key: never reuse an id for a different goal. */
  id: string
  label: string
  msg: string
  metric: Metric
  num: number
  good: string[]
  /** Omitted for the original Growth Journey goals; placement never changes claim identity. */
  tab?: MilestoneTab
}

export const MILESTONES: readonly Milestone[] = [
  { id: 'first-meal', label: '第一顿饭', msg: '给宠物喂食 1 次。', metric: 'Eat', num: 1, good: ['_yb*10', '_102010001*2'] },
  { id: 'first-bath', label: '洗得香香', msg: '使用清洁用品 1 次。', metric: 'Clean', num: 1, good: ['_yb*10', '_102020003*1'] },
  { id: 'first-toy', label: '一起玩耍', msg: '使用玩具 1 次。', metric: 'Toy', num: 1, good: ['_yb*10'] },
  { id: 'care-30', label: '细心照料', msg: '喂食、清洁和玩耍合计累计 30 次。', metric: 'care', num: 30, good: ['_yb*50', '_102010001*3'] },
  { id: 'care-100', label: '默契伙伴', msg: '喂食、清洁和玩耍合计累计 100 次。', metric: 'care', num: 100, good: ['_yb*100', '_102020003*3'] },
  { id: 'level-2', label: '初露头角', msg: '宠物达到 2 级。', metric: 'level', num: 2, good: ['_yb*20'] },
  { id: 'level-5', label: '慢慢长大', msg: '宠物达到 5 级。', metric: 'level', num: 5, good: ['_yb*50'] },
  { id: 'level-10', label: '成长足迹', msg: '宠物达到 10 级。', metric: 'level', num: 10, good: ['_yb*100'] },
  { id: 'level-20', label: '独当一面', msg: '宠物达到 20 级。', metric: 'level', num: 20, good: ['_yb*200'] },
  { id: 'online-hour', label: '相伴一小时', msg: '累计在线陪伴 60 分钟。', metric: 'online', num: 60, good: ['_yb*20'] },
  { id: 'online-day', label: '朝夕相伴', msg: '累计在线陪伴 1440 分钟（24 小时）。', metric: 'online', num: 1440, good: ['_yb*100'] },
  { id: 'first-lesson', label: '开学第一课', msg: '完成 1 节课，下课后计入进度。', metric: 'Study', num: 1, good: ['_yb*20'] },
  { id: 'lessons-10', label: '勤学不辍', msg: '累计完成 10 节课。', metric: 'Study', num: 10, good: ['_yb*50'] },
  { id: 'first-diploma', label: '第一张学历', msg: '任意一科学满小学课时，并通过升学考试。', metric: 'primary', num: 1, good: ['_yb*60'] },
  { id: 'primary-3', label: '全面发展', msg: '取得 3 科小学或更高学历，每科都需通过考试。', metric: 'primary', num: 3, good: ['_yb*100'] },
  { id: 'middle-1', label: '学业进阶', msg: '任意一科通过中学升学考试，取得中学或更高学历。', metric: 'middle', num: 1, good: ['_yb*150'] },
  { id: 'first-shift', label: '第一份薪水', msg: '完成 1 次打工，下班后计入进度。', metric: 'Work', num: 1, good: ['_yb*20'] },
  { id: 'shifts-10', label: '勤劳的小手', msg: '累计完成 10 次打工。', metric: 'Work', num: 10, good: ['_yb*80'] },
  { id: 'first-trip', label: '初次远行', msg: '完成 1 次旅行，归来后计入进度。', metric: 'Travel1', num: 1, good: ['_yb*20'] },
  { id: 'provinces-5', label: '走过山河', msg: '在一轮旅行中点亮 5 个不同地区。', metric: 'provinces', num: 5, good: ['_yb*60'] },
  { id: 'provinces-10', label: '远方来信', msg: '在一轮旅行中点亮 10 个不同地区。', metric: 'provinces', num: 10, good: ['_yb*100'] },
  { id: 'collection-5', label: '收藏起步', msg: '图鉴收集 5 种不同物品。', metric: 'collection', num: 5, good: ['_yb*20'] },
  { id: 'collection-20', label: '小小收藏家', msg: '图鉴收集 20 种不同物品。', metric: 'collection', num: 20, good: ['_yb*60'] },
  { id: 'first-fish', label: '池塘初收获', msg: '收获 1 条成熟的鱼，提前卖出鱼苗不计入。', metric: 'fish', num: 1, good: ['_yb*20'] },
  { id: 'fish-10', label: '养鱼有方', msg: '累计收获 10 条成熟的鱼。', metric: 'fish', num: 10, good: ['_yb*60'] },
  { id: 'first-crop', label: '田园初收获', msg: '在农场收获一次成熟作物。', metric: 'farm', num: 1, good: ['_yb*20'] },
  { id: 'care-300', label: '照料有方', msg: '喂食、清洁和玩耍合计累计 300 次。', metric: 'care', num: 300, good: ['_yb*150', '_102010001*3'] },
  { id: 'care-1000', label: '长情守护', msg: '喂食、清洁和玩耍合计累计 1000 次。', metric: 'care', num: 1000, good: ['_yb*300', '_102020003*3'] },
  { id: 'meals-10', label: '按时开饭', msg: '累计喂食 10 次。', metric: 'Eat', num: 10, good: ['_yb*20'] },
  { id: 'meals-50', label: '暖心食堂', msg: '累计喂食 50 次。', metric: 'Eat', num: 50, good: ['_yb*60', '_102010001*2'] },
  { id: 'baths-10', label: '清爽日常', msg: '累计使用清洁用品 10 次。', metric: 'Clean', num: 10, good: ['_yb*20'] },
  { id: 'baths-50', label: '香香的约定', msg: '累计使用清洁用品 50 次。', metric: 'Clean', num: 50, good: ['_yb*60', '_102020003*2'] },
  { id: 'toys-10', label: '快乐时光', msg: '累计使用玩具 10 次。', metric: 'Toy', num: 10, good: ['_yb*20'] },
  { id: 'toys-50', label: '玩伴情深', msg: '累计使用玩具 50 次。', metric: 'Toy', num: 50, good: ['_yb*80'] },
  { id: 'level-30', label: '渐成大器', msg: '宠物达到 30 级。', metric: 'level', num: 30, good: ['_yb*250'] },
  { id: 'level-50', label: '一路成长', msg: '宠物达到 50 级。', metric: 'level', num: 50, good: ['_yb*300'] },
  { id: 'online-3days', label: '三日相伴', msg: '累计在线陪伴 4320 分钟（72 小时）。', metric: 'online', num: 4320, good: ['_yb*120'] },
  { id: 'online-week', label: '一周的回忆', msg: '累计在线陪伴 10080 分钟（168 小时）。', metric: 'online', num: 10080, good: ['_yb*200'] },
  { id: 'online-month', label: '长久相伴', msg: '累计在线陪伴 43200 分钟（720 小时）。', metric: 'online', num: 43200, good: ['_yb*300'] },
  { id: 'trips-10', label: '背上小行囊', msg: '累计完成 10 次旅行。', metric: 'Travel1', num: 10, good: ['_yb*50'] },
  { id: 'trips-30', label: '旅途常客', msg: '累计完成 30 次旅行。', metric: 'Travel1', num: 30, good: ['_yb*100'] },
  { id: 'trips-100', label: '行路百回', msg: '累计完成 100 次旅行。', metric: 'Travel1', num: 100, good: ['_yb*200'] },
  { id: 'provinces-20', label: '山河入梦', msg: '在一轮旅行中点亮 20 个不同地区。', metric: 'provinces', num: 20, good: ['_yb*150'] },
  { id: 'provinces-35', label: '山河满卷', msg: '在一轮旅行中点亮 35 个不同地区。', metric: 'provinces', num: 35, good: ['_yb*250'] },
  { id: 'collection-50', label: '收藏成册', msg: '图鉴收集 50 种不同物品。', metric: 'collection', num: 50, good: ['_yb*100'] },
  { id: 'collection-100', label: '百物珍藏', msg: '图鉴收集 100 种不同物品。', metric: 'collection', num: 100, good: ['_yb*200'] },
  { id: 'fish-50', label: '池塘丰收', msg: '累计收获 50 条成熟的鱼。', metric: 'fish', num: 50, good: ['_yb*100'] },
  { id: 'fish-100', label: '养鱼能手', msg: '累计收获 100 条成熟的鱼。', metric: 'fish', num: 100, good: ['_yb*200'] },
  { id: 'games-10', label: '游戏初体验', msg: '累计完成 10 局小游戏。', metric: 'GameRound', num: 10, good: ['_yb*30'] },
  { id: 'games-50', label: '欢乐游乐场', msg: '累计完成 50 局小游戏。', metric: 'GameRound', num: 50, good: ['_yb*100'] },
  { id: 'amusing-1', tab: 'ddw', label: '初见笑颜', msg: '累计逗乐 1 次。', metric: 'Amusing', num: 1, good: ['_yb*10'] },
  { id: 'amusing-25', tab: 'ddw', label: '开心一整天', msg: '累计逗乐 25 次。', metric: 'Amusing', num: 25, good: ['_yb*20'] },
  { id: 'amusing-100', tab: 'ddw', label: '逗趣搭档', msg: '累计逗乐 100 次。', metric: 'Amusing', num: 100, good: ['_yb*50'] },
  { id: 'amusing-300', tab: 'ddw', label: '笑声满屋', msg: '累计逗乐 300 次。', metric: 'Amusing', num: 300, good: ['_yb*100'] },
  { id: 'amusing-1000', tab: 'ddw', label: '千次欢笑', msg: '累计逗乐 1000 次。', metric: 'Amusing', num: 1000, good: ['_yb*150'] },
  { id: 'amusing-3000', tab: 'ddw', label: '最佳开心果', msg: '累计逗乐 3000 次。', metric: 'Amusing', num: 3000, good: ['_yb*200'] },
  { id: 'lessons-25', tab: 'growth', label: '书声琅琅', msg: '累计完成 25 节课。', metric: 'Study', num: 25, good: ['_yb*60'] },
  { id: 'lessons-50', tab: 'growth', label: '求知之路', msg: '累计完成 50 节课。', metric: 'Study', num: 50, good: ['_yb*100'] },
  { id: 'lessons-100', tab: 'growth', label: '百课积累', msg: '累计完成 100 节课。', metric: 'Study', num: 100, good: ['_yb*150'] },
  { id: 'lessons-300', tab: 'growth', label: '学海泛舟', msg: '累计完成 300 节课。', metric: 'Study', num: 300, good: ['_yb*200'] },
  { id: 'shifts-5', tab: 'growth', label: '工作上手', msg: '累计完成 5 次打工，下班后计入。', metric: 'Work', num: 5, good: ['_yb*30'] },
  { id: 'shifts-30', tab: 'growth', label: '勤劳身影', msg: '累计完成 30 次打工。', metric: 'Work', num: 30, good: ['_yb*100'] },
  { id: 'shifts-100', tab: 'growth', label: '百次耕耘', msg: '累计完成 100 次打工。', metric: 'Work', num: 100, good: ['_yb*150'] },
  { id: 'shifts-300', tab: 'growth', label: '踏实奋进', msg: '累计完成 300 次打工。', metric: 'Work', num: 300, good: ['_yb*250'] },
  { id: 'primary-9', tab: 'growth', label: '小学全科通关', msg: '九科均取得小学或更高学历，每科都需通过考试。', metric: 'primary', num: 9, good: ['_yb*150'] },
  { id: 'middle-3', tab: 'growth', label: '中学三科进阶', msg: '取得 3 科中学或更高学历。', metric: 'middle', num: 3, good: ['_yb*200'] },
  { id: 'university-1', tab: 'growth', label: '大学初成', msg: '任意一科通过大学升学考试，取得大学或更高学历。', metric: 'university', num: 1, good: ['_yb*250'] },
  { id: 'postgraduate-1', tab: 'growth', label: '研途有成', msg: '任意一科通过研究生升学考试，取得研究生学历。', metric: 'postgraduate', num: 1, good: ['_yb*300'] },
]

const CAPS = new Map<Metric, number>()
for (const t of MILESTONES) CAPS.set(t.metric, Math.max(CAPS.get(t.metric) ?? 0, t.num))

export interface MilestoneProgress {
  counters: Partial<Record<LifetimeCounter, number>>
  /** Best observed value survives daily and tour resets, selling and replanting. */
  best: Partial<Record<Metric, number>>
  claimed: string[]
}

const nonnegative = (n: unknown): number => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const COUNTERS: LifetimeCounter[] = ['Eat', 'Clean', 'Toy', 'Amusing', 'Study', 'Work', 'Travel1', 'GameRound', 'Game']

/** Seed only the legacy counts actually saved; historical actions cannot be reconstructed. */
export function loadMilestones(raw: unknown, legacy: Partial<Record<LifetimeCounter, number>>): MilestoneProgress {
  const p = record(raw)
  const counters = record(raw ? p.counters : legacy)
  const best = record(p.best)
  const ids = new Set(MILESTONES.map(t => t.id))
  return {
    counters: Object.fromEntries(COUNTERS.map(k => [k, nonnegative(counters[k])])),
    best: Object.fromEntries([...CAPS.keys()].map(metric => [metric, nonnegative(best[metric])])),
    claimed: Array.isArray(p.claimed) ? [...new Set(p.claimed.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [],
  }
}

/** Optional farm history only proves a harvest when crops or harvested plots remain. */
export function hasFarmHarvest(raw: string | undefined): boolean {
  if (!raw) return false
  let user: Record<string, unknown>
  try { user = record(JSON.parse(raw)) } catch { return false /* Invalid optional history cannot prove a harvest. */ }
  return Array.isArray(user.warehouse) && user.warehouse.some(v => typeof record(v).fruit === 'string' && Number(record(v).number) > 0)
    || Array.isArray(user.farmland) && user.farmland.some(v => record(v).crop && record(v).harvest !== undefined)
}

/** Observe real save data; lesson counts 9/30 are exam-ready, diplomas start at 10/31. */
export function observeMilestones(p: MilestoneProgress, save: SaveData): boolean {
  const subjects = Object.values(save.studyInfo)
  const lessons = subjects.reduce((sum, v) => sum + v - [10, 31, 72, 168].filter(n => v >= n).length, 0)
  const metrics: Record<Metric, number> = {
    ...Object.fromEntries(COUNTERS.map(k => [k, nonnegative(p.counters[k])])) as Record<LifetimeCounter, number>,
    care: nonnegative(p.counters.Eat) + nonnegative(p.counters.Clean) + nonnegative(p.counters.Toy),
    level: save.petComputedlInfo.level,
    online: save.petInfo.onLineTime,
    primary: subjects.filter(v => v >= 10).length,
    middle: subjects.filter(v => v >= 31).length,
    university: subjects.filter(v => v >= 72).length,
    postgraduate: subjects.filter(v => v >= 168).length,
    provinces: new Set(save.gameSaveDatas.travel_china.map(t => t.name)).size,
    collection: new Set(save.illustrated.filter(v => typeof v === 'string')).size,
    fish: save.gameSaveDatas.yyds * 1000 + save.gameSaveDatas.fishing_harvestfish,
    farm: Number(hasFarmHarvest(save.saveJsonData.farm)),
  }
  metrics.Study = Math.max(metrics.Study, lessons)
  metrics.Amusing = Math.max(metrics.Amusing, save.gameSaveDatas.ddw)
  metrics.Travel1 = Math.max(metrics.Travel1, save.gameSaveDatas.travel_china.reduce((n, t) => n + t.value, 0))
  let changed = false
  for (const [metric, cap] of CAPS) {
    // Only persist values used by a goal, bounded by the largest target for that metric.
    const value = Math.min(cap, Math.max(nonnegative(p.best[metric]), nonnegative(metrics[metric])))
    if (value !== p.best[metric]) { p.best[metric] = value; changed = true }
  }
  return changed
}
