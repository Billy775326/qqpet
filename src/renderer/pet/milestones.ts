import type { SaveData } from '../../shared/save'

export type LifetimeCounter = 'Eat' | 'Clean' | 'Toy' | 'Amusing' | 'Study' | 'Work' | 'Travel1' | 'GameRound' | 'Game'
type Metric = LifetimeCounter | 'care' | 'level' | 'primary' | 'middle' | 'provinces' | 'collection' | 'fish' | 'farm' | 'online'

interface Milestone {
  /** Permanent save key: never reuse an id for a different goal. */
  id: string
  label: string
  msg: string
  metric: Metric
  num: number
  good: string[]
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
]

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
    best: Object.fromEntries(MILESTONES.map(t => [t.metric, nonnegative(best[t.metric])])),
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
    provinces: new Set(save.gameSaveDatas.travel_china.map(t => t.name)).size,
    collection: new Set(save.illustrated.filter(v => typeof v === 'string')).size,
    fish: save.gameSaveDatas.yyds * 1000 + save.gameSaveDatas.fishing_harvestfish,
    farm: Number(hasFarmHarvest(save.saveJsonData.farm)),
  }
  metrics.Study = Math.max(metrics.Study, lessons)
  metrics.Travel1 = Math.max(metrics.Travel1, save.gameSaveDatas.travel_china.reduce((n, t) => n + t.value, 0))
  let changed = false
  for (const t of MILESTONES) {
    // Only persist values used by a goal, bounded by the largest target for that metric.
    const cap = Math.max(...MILESTONES.filter(other => other.metric === t.metric).map(other => other.num))
    const value = Math.min(cap, Math.max(nonnegative(p.best[t.metric]), nonnegative(metrics[t.metric])))
    if (value !== p.best[t.metric]) { p.best[t.metric] = value; changed = true }
  }
  return changed
}
