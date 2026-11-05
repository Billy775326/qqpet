import type { Good } from '../pet/data/goods'
import { info } from '../pet/store'
import { claim, claimMilestone, milestones, tasks, todayTasks, type Tab } from '../pet/tasks'
import { openBox } from './box'
import './css/task.css'
import { button, div, img } from './dom'
import { showResult } from './result'

type Group = 'daily' | 'once' | 'travel'
interface Row {
  id: string
  label: string
  msg: string
  num: number
  done: number
  take: boolean
  good: Good[]
  source: string
  claim: () => Good[] | false
}
const GROUPS: Record<Group, string> = { daily: '每日任务', once: '一次性任务', travel: '旅行挑战' }
const FILTERS: Record<'all' | Tab, string> = { all: '全部', daily: '今日委托', ddw: '逗逗我', growth: '学习打工', travel: '旅行日常' }
const HINTS: Record<Group, string> = {
  daily: '每天 06:00 重置；托管仅自动完成「今日委托」并领奖。',
  once: '每项仅可领取一次；每日重置和完成一轮旅行不会清除进度。',
  travel: '跨天保留；在旅游界面完成一轮旅行后，挑战可重新领取。',
}
const rank = (t: Row): number => t.take ? 2 : t.done >= t.num ? 0 : 1

/** Retain source indices even when filtering and sorting, so rewards match the visible goal. */
function dailyRows(): Row[] {
  return (['daily', 'ddw', 'growth', 'travel'] as Tab[]).flatMap(tab =>
    (tab === 'daily' ? todayTasks() : tasks(tab)).flatMap((t, i) => t.keep ? [] : [{
      ...t, id: `${tab}-${i}`, source: FILTERS[tab], claim: () => claim(tab, i),
    }]),
  )
}

const action = (cls: string, click: () => void, ...children: (Node | string)[]): HTMLDivElement => {
  const el = button(cls, click, ...children)
  el.setAttribute('role', 'button')
  el.tabIndex = 0
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    click()
  })
  return el
}

let open = false

export function openTask(): void {
  if (open) return
  open = true
  const root = div('ui-task')
  let group: Group = 'daily'
  let filter: keyof typeof FILTERS = 'all'
  let previous = ''

  const render = (force = false): void => {
    // Keep the reward confirmation visible while background growth changes progress.
    if (!force && root.querySelector('.markFull')) return
    const daily = dailyRows()
    const once: Row[] = milestones().map(t => ({ ...t, source: '成长里程碑', claim: () => claimMilestone(t.id) }))
    const travel: Row[] = tasks('travel').flatMap((t, i) => t.keep ? [{ ...t, id: `travel-${i}`, source: '本轮旅行', claim: () => claim('travel', i) }] : [])
    const groups: Record<Group, Row[]> = { daily, once, travel }
    const visible = groups[group].filter(t => group !== 'daily' || filter === 'all' || t.source === FILTERS[filter]).sort((a, b) => rank(a) - rank(b))
    const signature = JSON.stringify({ group, filter, groups })
    if (!force && signature === previous) return
    previous = signature
    const scrollTop = root.querySelector('.tasks')?.scrollTop ?? 0
    const tabs = (Object.keys(GROUPS) as Group[]).map(k => {
      const ready = groups[k].filter(t => rank(t) === 0).length
      const el = action(`t_tab${k === group ? ' active' : ''}`, () => { group = k; root.querySelector('.tasks')?.scrollTo(0, 0); render(true) }, GROUPS[k], ...(ready ? [div('taskBadge', String(ready))] : []))
      el.dataset.group = k
      el.setAttribute('aria-pressed', String(k === group))
      return el
    })
    const filters = group === 'daily' ? div('taskFilters', ...(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map(k => {
      const el = action(`taskFilter${k === filter ? ' active' : ''}`, () => { filter = k; root.querySelector('.tasks')?.scrollTo(0, 0); render(true) }, FILTERS[k])
      el.dataset.filter = k
      el.setAttribute('aria-pressed', String(k === filter))
      return el
    })) : null
    const items = visible.map(t => {
      const ready = !t.take && t.done >= t.num
      const take = action(`but_small taskClaim${ready ? '' : ' disable'}`, () => {
        if (!ready || t.take) return
        const goods = t.claim()
        render(true)
        if (goods) showResult(root, goods)
      }, t.take ? '已领取' : ready ? '领取' : '进行中')
      take.setAttribute('aria-disabled', String(!ready))
      take.tabIndex = ready ? 0 : -1
      const rewards = div('taskRewards', ...t.good.map(g => Object.assign(div('taskReward', img('goodImg', g.url), div('rewardNum', `×${g.num}`)), {
        title: `${g.outOfPrint ? '绝版：' : ''}${g.name} × ${g.num}`,
      })))
      const row = div(`taskOnce${t.take ? ' claimed' : ready ? ' ready' : ''}`,
        div('to_left', div('taskHeading', div('to_label', t.label), div('taskProgress', `${Math.min(Math.floor(t.done), t.num)}/${t.num}`)), div('to_msg', t.msg), div('taskSource', t.source)),
        div('to_right', rewards, take),
      )
      row.dataset.taskId = t.id
      return row
    })
    const ready = visible.filter(t => rank(t) === 0).length
    const list = div('tasks f1 h0', ...(items.length ? items : [div('taskEmpty', '今日委托准备中，请稍候。')]))
    root.replaceChildren(div('task fC', div('t_top f1 fC h0',
      div('t_title', '任务表'), div('t_tabs', ...tabs), div('taskHint', HINTS[group]),
      ...(filters ? [filters] : []),
      div('taskSummary', `共 ${visible.length} 项 · 可领取 ${ready} 项 · 已领取 ${visible.filter(t => t.take).length} 项`), list,
      ...(group === 'once' ? [div('taskFootnote', '旧存档按现存等级、学历、图鉴和收获记录计入；操作次数从已保存记录开始累计。')] : []),
    )))
    list.scrollTop = scrollTop
  }
  render()
  // Refresh only this open panel, without rebuilding unchanged rows or accumulating timers.
  const timer = window.setInterval(render, 1000)
  openBox(root, { vip: info.pinkDiamond, onClose: () => { clearInterval(timer); open = false } })
}
