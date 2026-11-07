import type { CalendarDay } from '../../shared/ipc'
import { parseGood, type Good } from './data/goods'
import { give } from './items'
import { loot } from './loot'
import { loadMilestones, MILESTONES, observeMilestones, type MilestoneProgress, type MilestoneTab } from './milestones'
import { rand } from './rand'
import { info, save, update } from './store'
import { dayStart } from './vip'

export type { Counter, Tab } from './data/task-definitions'
import { DDW, TASKS, type Counter, type Tab, type Task } from './data/task-definitions'

export const TABS: Record<Tab, string> = { daily: '今日任务', ddw: '逗逗我', growth: '学习打工', travel: '旅游任务' }

/**
 * Progress kept in saveJsonData.task, in the original's shape: entries line up with TASKS.
 * `daily` holds today's generated tasks, made on the day starting at `dailyDay`.
 */
interface Progress {
  doNums: Partial<Record<Counter, number>>
  taskList: Record<Tab, { take: boolean; good: Good[] }[]>
  daily: Task[]
  dailyDay: number
  milestones: MilestoneProgress
}

const rewards = (t: Task): Good[] => [...(t.reroll ? loot(t.reroll) : []), ...(t.good ?? []).map(parseGood)]

function load(): Progress {
  const p: Partial<Progress> = JSON.parse(save.saveJsonData.task || '{}')
  // The original stored whole task objects, `take` only once claimed; the definitions here stay authoritative.
  const entry = (t: Task, e?: { take?: boolean; good: Good[] }) => (e ? { take: e.take === true, good: e.good } : { take: false, good: rewards(t) })
  const list = (tab: keyof typeof TASKS) => TASKS[tab].map((t, i) => entry(t, p.taskList?.[tab]?.[i]))
  return {
    doNums: p.doNums ?? {},
    taskList: { daily: p.taskList?.daily ?? [], ddw: list('ddw'), growth: list('growth'), travel: list('travel') },
    daily: p.daily ?? [],
    dailyDay: p.dailyDay ?? 0,
    milestones: loadMilestones(p.milestones, p.doNums ?? {}),
  }
}

const progress = load()
const store = (): void => update('saveJsonData', { task: JSON.stringify(progress) })
const defs = (tab: Tab): Task[] => (tab === 'daily' ? progress.daily : TASKS[tab])

/** Snapshot permanent goals before a reset or a farm sale can remove the evidence. */
export function refreshMilestones(): void {
  if (observeMilestones(progress.milestones, save)) store()
}

export function milestones(tab?: MilestoneTab) {
  refreshMilestones()
  return MILESTONES.filter(t => !tab || (t.tab ?? 'milestones') === tab).map(t => ({
    ...t, good: t.good.map(parseGood), done: progress.milestones.best[t.metric] ?? 0,
    take: progress.milestones.claimed.includes(t.id),
  }))
}

export function claimMilestone(id: string): Good[] | false {
  const t = milestones().find(t => t.id === id)
  if (!t || t.take || t.done < t.num) return false
  // Acknowledge the claim before granting items; a repeated click cannot grant twice.
  progress.milestones.claimed.push(id)
  store()
  give(t.good, `[host],我们完成${t.label}任务啦！~~`)
  return t.good
}

export function count(obj: Counter): number {
  return obj === 'Travel2' ? save.gameSaveDatas.travel_china.length : (progress.doNums[obj] ?? 0)
}

export function addCount(obj: Exclude<Counter, 'Travel2'>, n = 1): void {
  if (!Number.isFinite(n) || n <= 0) return
  progress.doNums[obj] = count(obj) + n
  progress.milestones.counters[obj] = (progress.milestones.counters[obj] ?? 0) + n
  observeMilestones(progress.milestones, save)
  store()
}

export const tasks = (tab: Tab) => defs(tab).map((t, i) => ({ ...t, ...progress.taskList[tab][i], done: count(t.obj) }))

/** Stale tasks must not be performed or claimed before the new day's list arrives. */
export const todayTasks = () => progress.dailyDay === dayStart() ? tasks('daily') : []

/** All daily-reset goals, retaining their original claim destinations. Wait for day rollover to finish. */
export function dailyTasks() {
  if (progress.dailyDay !== dayStart()) return []
  return (Object.keys(TABS) as Tab[]).flatMap(tab => tasks(tab).flatMap((t, index) => t.keep ? [] : [{ ...t, tab, index }]))
}

/** Hands out a finished task's goods; false when it is not finished yet. */
export function claim(tab: Tab, i: number): Good[] | false {
  const t = defs(tab)[i]
  const p = progress.taskList[tab][i]
  if (!t || !p || p.take || count(t.obj) < t.num || tab === 'daily' && progress.dailyDay !== dayStart()) return false
  p.take = true
  store()
  give(p.good, `[host],我们完成${t.label}任务啦！~~`)
  return p.good
}

/** 06:00: daily tasks open again, with fresh random rewards, and the day's counters restart. */
export function resetTasks(): void {
  observeMilestones(progress.milestones, save)
  for (const tab of Object.keys(TASKS) as (keyof typeof TASKS)[])
    TASKS[tab].forEach((t, i) => {
      const p = progress.taskList[tab][i]
      if (!t.keep) p.take = false
      if (t.reroll) p.good = rewards(t)
    })
  progress.doNums = {}
  store()
}

/** Kinds of daily task; one the pet `needs` right now (`off`: a day off) is three times as likely, and says so; one it `can`not do is left out. */
const KINDS: {
  obj: Exclude<Counter, 'Travel2'>
  label: string
  num: [number, number]
  needs: (off: boolean) => boolean
  can?: () => boolean
  msg: [string, string]
}[] = [
  {
    obj: 'Eat',
    label: '喂我吃东西{n}次',
    num: [2, 4],
    needs: () => info.hunger < save.petComputedlInfo.hungerMax / 2,
    msg: ['肚子咕咕叫啦，快给我吃点东西吧~', '吃饱饱才能长高高~'],
  },
  {
    obj: 'Clean',
    label: '帮我洗香香{n}次',
    num: [1, 3],
    needs: () => info.clean < save.petComputedlInfo.cleanMax / 2,
    msg: ['身上脏脏的，好难受呀~', '香香的才招人喜欢~'],
  },
  { obj: 'Toy', label: '陪我玩玩具{n}次', num: [2, 4], needs: () => info.mood < 500, msg: ['人家不开心，陪我玩一会儿嘛~', '一起玩最开心啦~'] },
  { obj: 'Amusing', label: '逗逗我{n}次', num: [10, 20], needs: () => info.mood < 500, msg: ['心情不好，逗我笑一笑吧~', DDW] },
  {
    obj: 'Work',
    label: '去打工{n}次',
    num: [1, 3],
    needs: () => info.yb < 500,
    can: () => save.petComputedlInfo.level >= 2,
    msg: ['家里没钱啦，我去打工赚元宝吧~', '勤劳致富，打工去咯~'],
  },
  { obj: 'Study', label: '去上学{n}次', num: [1, 2], needs: (off) => !off, msg: ['上学日要好好学习哦~', '书山有路勤为径~'] },
  {
    obj: 'GameRound',
    label: '玩{n}局小游戏',
    num: [2, 4],
    needs: (off) => off,
    msg: ['放假啦，痛快玩几局吧~', '换个小游戏玩玩吧~'],
  },
  { obj: 'Game', label: '陪我玩小游戏{n}分钟', num: [5, 15], needs: () => info.mood < 500, msg: ['好无聊呀，陪我玩会儿小游戏吧~', '一起玩小游戏吧~'] },
  {
    obj: 'Travel1',
    label: '带我去旅游{n}次',
    num: [1, 2],
    needs: (off) => off,
    msg: ['放假啦，出去走走吧~', '读万卷书，行万里路~'],
  },
]

/** Today's four tasks drawn by the pet's needs, plus one on statutory holidays; made once per day. */
export function rollDaily(today?: CalendarDay): void {
  if (progress.dailyDay === dayStart()) return
  // Offline, weekends are the days off; the calendar knows holidays and make-up working days.
  const off = today?.holiday ? today.holiday.off : [0, 6].includes(new Date().getDay())
  const pool = KINDS.filter((k) => k.can?.() ?? true).flatMap((k) => Array<typeof k>(k.needs(off) ? 3 : 1).fill(k))
  const daily: Task[] = []
  while (daily.length < 4) {
    const k = pool[rand(0, pool.length - 1)]
    const num = rand(...k.num)
    if (!daily.some((t) => t.obj === k.obj))
      daily.push({ label: k.label.replace('{n}', String(num)), msg: k.msg[k.needs(off) ? 0 : 1], obj: k.obj, num, reroll: 1, good: [`_yb*${rand(2, 5) * 10}`] })
  }
  const h = today?.holiday
  if (h?.off) daily.push({ label: `${h.name}快乐`, msg: `过节啦，陪我玩5次玩具一起庆祝吧~`, obj: 'Toy', num: 5, reroll: 2, good: ['_yb*100'] })
  progress.daily = daily
  progress.dailyDay = dayStart()
  progress.taskList.daily = daily.map((t) => ({ take: false, good: rewards(t) }))
  store()
}

/** Finishing the tour clears the visited provinces, so the city tasks can be done again. */
export function resetTour(): void {
  observeMilestones(progress.milestones, save)
  for (const p of progress.taskList.travel.slice(2)) p.take = false
  store()
}
