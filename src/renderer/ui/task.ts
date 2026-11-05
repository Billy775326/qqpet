import { info } from '../pet/store'
import { claim, claimMilestone, milestones, TABS, tasks, todayTasks, type Tab } from '../pet/tasks'
import { openBox } from './box'
import './css/task.css'
import { button, div, img } from './dom'
import { showResult } from './result'

type TaskTab = Tab | 'milestones'
const TASK_TABS: Record<TaskTab, string> = { ...TABS, milestones: '成长历程' }
const HELP: Record<TaskTab, string> = {
  daily: '每日 06:00 重置；托管可自动完成本页任务并领奖。',
  ddw: '每日 06:00 重置。',
  growth: '每日 06:00 重置。',
  travel: '每日旅游次数于 06:00 重置；地区挑战在完成一轮旅行后重置。',
  milestones: '成长目标每项仅可领取一次，进度随存档永久保留。',
}

let open = false

export function openTask(): void {
  if (open) return
  open = true
  const root = div('ui-task')
  let tab: TaskTab = 'daily'
  let previous = ''

  const render = (force = false): void => {
    if (!force && root.querySelector('.markFull')) return
    const source = tab
    const goals = source === 'milestones' ? milestones() : []
    const current = source === 'milestones' ? goals : source === 'daily' ? todayTasks() : tasks(source)
    const signature = JSON.stringify({ tab, current })
    if (!force && signature === previous) return
    previous = signature
    const scrollTop = root.querySelector('.tasks')?.scrollTop ?? 0
    const items = current.map((t, i) => {
      const take = source === 'milestones' ? () => claimMilestone(goals[i].id) : () => claim(source, i)
      const row = div(
        'taskOnce fc',
        div('to_left f1 fC w0', div('to_label', `${t.label}（${tab === 'milestones' ? Math.min(t.done, t.num) : t.done}/${t.num}） `), div('to_msg', t.msg)),
        div(
          'to_right fc',
          ...t.good.map((g) => Object.assign(img('goodImg', g.url), { title: `${g.outOfPrint ? '绝版：' : ''}${g.name}*${g.num}` })),
          button(
            t.take ? 'but_small taskClaim disable' : 'but_small taskClaim',
            () => {
              if (t.take) return
              const goods = take()
              render(true)
              showResult(root, goods || [], '还没完成任务哦！~~')
            },
            t.take ? '已领取' : '领取',
          ),
        ),
      )
      row.dataset.taskId = source === 'milestones' ? goals[i].id : `${source}-${i}`
      return row
    })
    const tabs = (Object.keys(TASK_TABS) as TaskTab[]).map((k) => {
      const el = button(
        k === tab ? 't_tab mr8 active' : 't_tab mr8',
        () => {
          tab = k
          root.querySelector('.tasks')?.scrollTo(0, 0)
          render(true)
        },
        TASK_TABS[k],
      )
      el.dataset.tab = k
      el.title = HELP[k]
      return el
    })
    const list = div('tasks f1 mt8 h0', ...items)
    root.replaceChildren(div('task fC', div('t_top f1 fC h0', div('t_title', '活动列表'), div('t_tabs', ...tabs), list)))
    list.scrollTop = scrollTop
  }
  render()
  const timer = window.setInterval(render, 1000)
  openBox(root, { vip: info.pinkDiamond, onClose: () => { clearInterval(timer); open = false } })
}
