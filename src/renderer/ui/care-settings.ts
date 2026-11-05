import { CARE_NEEDS, canBuyCareGood, careGoods } from '../pet/care'
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
  const care = div('careSupplies')
  care.setAttribute('role', 'group')
  care.setAttribute('aria-label', '日常照料')
  const columns = div('careGrid careColumns', div('', '项目'), div('', '触发限额'), div('', '使用用品'))
  columns.setAttribute('aria-hidden', 'true')
  care.append(div('careSectionHeading', div('careLabel', '日常照料'), div('careHint', '低于限额时自动照料')), columns)
  const percentFields: HTMLInputElement[] = []
  for (const need of CARE_NEEDS) {
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '1'
    slider.max = '100'
    slider.step = '1'
    slider.value = String(draft[need.percent])
    slider.setAttribute('aria-label', `自动${need.label}限额`)
    const percent = document.createElement('input')
    percent.type = 'number'
    percent.className = 'carePercent'
    percent.min = '1'
    percent.max = '100'
    percent.step = '1'
    percent.required = true
    percent.value = slider.value
    percent.setAttribute('aria-label', `自动${need.label}限额百分比`)
    percentFields.push(percent)
    const threshold = div('careThreshold', percent, div('carePercentUnit', '%'))
    const describeThreshold = (): void => {
      percent.value = slider.value
      const description = `${need.statLabel}值低于上限的 ${slider.value}%（当前约 ${Math.round(save.petComputedlInfo[`${need.stat}Max`] * Number(slider.value) / 100)}）时${need.label}`
      slider.setAttribute('aria-valuetext', description)
      percent.setAttribute('aria-valuetext', description)
      percent.title = '输入 1–100 的整数，可用上下按钮逐 1% 微调；' + description
      slider.title = threshold.title = description
    }
    slider.addEventListener('input', () => {
      draft[need.percent] = Number(slider.value)
      describeThreshold()
    })
    describeThreshold()
    percent.addEventListener('input', () => {
      error.textContent = ''
      if (!percent.validity.valid) return
      draft[need.percent] = percent.valueAsNumber
      slider.value = percent.value
      describeThreshold()
    })
    const items = document.createElement('select')
    items.setAttribute('aria-label', need.itemLabel)
    items.add(new Option('自动选择', ''))
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
    const describeItem = (): void => { items.title = items.selectedOptions[0]?.textContent ?? '' }
    describeItem()
    items.addEventListener('change', () => { draft[need.item] = items.value; describeItem() })
    const row = div('careGrid careRow', div('careCategory', need.label), div('careRange', slider, threshold), items)
    row.dataset.type = need.type
    care.append(row)
  }
  care.append(div('careHint careSuppliesHint', '限额对应饥饿、清洁、心情；自动选择优先使用背包。'))

  const daily = document.createElement('input')
  daily.type = 'checkbox'
  daily.checked = draft.careAutoDaily
  daily.setAttribute('aria-label', '自动完成每日任务')
  daily.dataset.setting = 'careAutoDaily'
  daily.addEventListener('change', () => { draft.careAutoDaily = daily.checked })
  const dailyLabel = document.createElement('label')
  dailyLabel.className = 'careToggle careDailyToggle'
  dailyLabel.append(daily, div('', '自动完成每日任务并领奖'))

  const autoBuy = document.createElement('input')
  autoBuy.type = 'checkbox'
  autoBuy.checked = draft.careAutoBuy
  autoBuy.setAttribute('aria-label', '自动购买托管用品')
  autoBuy.dataset.setting = 'careAutoBuy'
  autoBuy.addEventListener('change', () => { draft.careAutoBuy = autoBuy.checked })
  const toggle = document.createElement('label')
  toggle.className = 'careToggle'
  toggle.append(autoBuy, div('', '缺货时自动购买用品'))
  care.append(div('careRestocking', toggle, div('careHint', '每次补 1 份')))
  const rules = document.createElement('details')
  rules.className = 'careRules'
  const summary = document.createElement('summary')
  summary.textContent = '执行与购买规则'
  rules.append(
    summary,
    div('careHint', '指定用品后仅使用该用品；自动选择优先使用背包。缺货且允许购买时，自动选择会购买当前类别可买的最低单价用品，遵循商城、等级、粉钻和余额限制。'),
    div('careHint', '自动完成今日任务、逗逗我、学习打工及旅游任务中的每日目标，并领取奖励。照料未低于限额时等待，不消耗或购买用品。小游戏与升学考试仍需手动操作；各页的一次性目标和地区旅游挑战手动领奖。'),
    div('careHint', '已有活动或正在操作界面时不启动新任务；关闭自动任务后，已开始的活动正常结束。'),
  )
  const error = div('careError')
  error.setAttribute('role', 'alert')
  const content = div(
    'sweetHeartCareSettings focusPress',
    div('careHeader', div('careTitle', '托管设置'), action('关闭', 'careClose', () => close())),
    div('careHint careNotice', '贴心宝贝已开启且未到期时，以下设置生效。'),
    care,
    div('careDaily', dailyLabel, div('careHint', '空闲时执行，照料遵守上方限额；小游戏与考试需手动。')),
    rules,
    error,
    div('careActions', action('取消', 'careCancel', () => close()), action('保存设置', 'careSave', () => {
      const invalid = percentFields.find(field => !field.validity.valid)
      if (invalid) {
        error.textContent = '触发限额请输入 1–100 的整数。'
        invalid.focus()
        return
      }
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
    if ((event.target as Element).closest('input, select, button, label, summary')) event.stopPropagation()
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
