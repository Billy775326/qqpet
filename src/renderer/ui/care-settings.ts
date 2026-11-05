import { CARE_NEEDS, canBuyCareGood, careGoods, type CareNeed } from '../pet/care'
import { price } from '../pet/items'
import { save, update } from '../pet/store'
import { openFrame } from './box'
import { div } from './dom'
import './css/care-settings.css'

let closeCurrent = (): void => {}

/** Draft changes are saved together; closing/canceling leaves the current policy intact. */
export function openCareSettings(): void {
  closeCurrent()
  const preferences = () => ({
    careHungerPercent: save.settings.careHungerPercent ?? 60,
    careFoodId: save.settings.careFoodId ?? '',
    careCleanPercent: save.settings.careCleanPercent ?? 60,
    careCleanId: save.settings.careCleanId ?? '',
    careMoodPercent: save.settings.careMoodPercent ?? 60,
    careToyId: save.settings.careToyId ?? '',
    careAutoBuy: save.settings.careAutoBuy ?? false,
    careAutoDaily: save.settings.careAutoDaily ?? false,
  })
  const draft = preferences()
  const action = (label: string, cls: string, run: () => void): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = cls
    b.textContent = label
    b.addEventListener('click', run)
    return b
  }
  const section = (title: string, ...children: (Node | string)[]): HTMLElement => div('careSection', div('careLabel', title), ...children)
  const details = div('careDetails')
  const tabs = div('careTabs')
  tabs.setAttribute('role', 'tablist')
  tabs.setAttribute('aria-label', '托管类别')
  const selectTab = (type: string): void => {
    details.dataset.type = type
    for (const tab of tabs.children) tab.setAttribute('aria-selected', String((tab as HTMLElement).dataset.type === type))
  }
  const render = (need: CareNeed): void => {
    selectTab(need.type)
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '1'
    slider.max = '100'
    slider.step = '1'
    slider.value = String(draft[need.percent])
    slider.setAttribute('aria-label', `自动${need.label}限额`)
    const threshold = div('careThreshold')
    const describeThreshold = (): void => {
      threshold.textContent = `${slider.value}%（当前约 ${Math.round(save.petComputedlInfo[`${need.stat}Max`] * Number(slider.value) / 100)}）`
    }
    slider.addEventListener('input', () => {
      draft[need.percent] = Number(slider.value)
      describeThreshold()
    })
    describeThreshold()
    const items = document.createElement('select')
    items.setAttribute('aria-label', need.itemLabel)
    items.add(new Option('自动选择（优先使用背包）', ''))
    for (const g of careGoods(need)) {
      const purchasable = canBuyCareGood(g)
      const status = g.num ? `背包 ${g.num} 份` : purchasable ? `${price(g)} 元宝/份` : '暂不可购买'
      const option = new Option(`${g.name} · ${need.statLabel} +${g[need.stat]} · ${status}`, g.id)
      option.disabled = !g.num && !purchasable
      items.add(option)
    }
    const selected = draft[need.item]
    if (selected && !Array.from(items.options).some(o => o.value === selected))
      items.add(new Option('原选择已不可用，请重新选择', selected))
    items.value = selected
    items.addEventListener('change', () => { draft[need.item] = items.value })
    details.replaceChildren(
      section(`自动${need.label}限额`, div('careHint', `${need.statLabel}值低于上限的以下比例时${need.label}。`), div('careRange', slider, threshold)),
      section(need.itemLabel, items, div('careHint', '指定后仅使用所选用品；自动选择时优先使用背包。')),
    )
  }
  for (const need of CARE_NEEDS) {
    const tab = action(need.label, 'careTab', () => render(need))
    tab.dataset.type = need.type
    tab.setAttribute('role', 'tab')
    tabs.append(tab)
  }
  const dailyTab = action('任务', 'careTab', () => {
    selectTab('daily')
    const daily = document.createElement('input')
    daily.type = 'checkbox'
    daily.checked = draft.careAutoDaily
    daily.setAttribute('aria-label', '自动完成每日任务')
    daily.dataset.setting = 'careAutoDaily'
    daily.addEventListener('change', () => { draft.careAutoDaily = daily.checked })
    const label = document.createElement('label')
    label.className = 'careToggle'
    label.append(daily, div('', '自动完成每日任务并领奖'))
    details.replaceChildren(
      section('今日任务', label, div('careHint', '空闲时自动喂食、清洁、玩耍、逗乐，或开始学习、打工、旅游；完成后领取今日任务奖励。')),
      div('careHint careDailyHint', '按正常耗时执行，用品选择和购买沿用托管设置。小游戏与升学考试仍需手动操作。'),
      div('careHint careDailyHint', '已有活动或正在操作界面时不启动新任务。关闭后停止新增任务，已开始的活动正常结束。'),
    )
  })
  dailyTab.dataset.type = 'daily'
  dailyTab.setAttribute('role', 'tab')
  tabs.append(dailyTab)
  render(CARE_NEEDS[0])

  const autoBuy = document.createElement('input')
  autoBuy.type = 'checkbox'
  autoBuy.checked = draft.careAutoBuy
  autoBuy.setAttribute('aria-label', '自动购买托管用品')
  autoBuy.dataset.setting = 'careAutoBuy'
  autoBuy.addEventListener('change', () => { draft.careAutoBuy = autoBuy.checked })
  const toggle = document.createElement('label')
  toggle.className = 'careToggle'
  toggle.append(autoBuy, div('', '自动购买托管用品'))
  const error = div('careError')
  error.setAttribute('role', 'alert')
  const content = div(
    'sweetHeartCareSettings focusPress',
    div('careHeader', div('careTitle', '托管设置'), action('关闭', 'careClose', () => close())),
    tabs,
    details,
    section('库存不足时', toggle, div('careHint', '适用于食物、清洁用品和玩具。开启后缺货按需买一份；自动选择时购买当前类别可买的最低单价用品。')),
    div('careHint careNotice', '设置仅在贴心宝贝已开启且未到期时生效。'),
    error,
    div('careActions', action('取消', 'careCancel', () => close()), action('保存设置', 'careSave', () => {
      const previous = preferences()
      try {
        update('settings', draft)
        close()
      } catch (cause) {
        Object.assign(save.settings, previous)
        console.warn('Could not save sweetheart care settings', cause)
        error.textContent = '保存失败，请重试。'
      }
    })),
  )
  content.addEventListener('pointerdown', event => {
    if ((event.target as Element).closest('input, select, button, label')) event.stopPropagation()
  })
  const remove = openFrame(content)
  const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
  const close = (): void => {
    document.removeEventListener('keydown', escape, true)
    remove()
    window.qqpet.setFocusable(false)
  }
  closeCurrent = close
  document.addEventListener('keydown', escape, true)
  window.qqpet.setFocusable(true)
}
