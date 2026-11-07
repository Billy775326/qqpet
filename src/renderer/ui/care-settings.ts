import { CARE_NEEDS, canBuyCareGood, careGoods } from '../pet/care'
import { price } from '../pet/items'
import { allGoods } from '../pet/data/goods'
import type { Settings } from '../../shared/save'
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
    careTrainingMode: save.settings.careTrainingMode ?? 'focused',
    careStudySubject: save.settings.careStudySubject ?? 'chinese',
    careWorkId: save.settings.careWorkId ?? '',
    careAutoFarm: save.settings.careAutoFarm ?? false,
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
  for (const need of CARE_NEEDS) {
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '1'
    slider.max = '100'
    slider.step = '1'
    slider.value = String(draft[need.percent])
    slider.setAttribute('aria-label', `自动${need.label}限额`)
    const threshold = div('careThreshold')
    const describeThreshold = (): void => {
      threshold.textContent = `${slider.value}%`
      const description = `${need.statLabel}值低于上限的 ${slider.value}%（当前约 ${Math.round(save.petComputedlInfo[`${need.stat}Max`] * Number(slider.value) / 100)}）时${need.label}`
      slider.setAttribute('aria-valuetext', description)
      threshold.title = description
      slider.title = description + '；滚轮或方向键每次微调 1%'
    }
    slider.addEventListener('input', () => {
      draft[need.percent] = Number(slider.value)
      describeThreshold()
    })
    slider.addEventListener('wheel', event => {
      if (!event.deltaY) return
      event.preventDefault()
      slider.stepUp(event.deltaY < 0 ? 1 : -1)
      slider.dispatchEvent(new Event('input'))
    }, { passive: false })
    describeThreshold()
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

  const mode = document.createElement('select')
  mode.setAttribute('aria-label', '培养方式')
  mode.dataset.setting = 'careTrainingMode'
  mode.add(new Option('专一培养', 'focused'))
  mode.add(new Option('均衡培养', 'balanced'))
  mode.value = draft.careTrainingMode
  const subject = document.createElement('select')
  subject.setAttribute('aria-label', '优先科目')
  subject.dataset.setting = 'careStudySubject'
  for (const g of allGoods('study').filter(g => g.id.startsWith('xx-'))) subject.add(new Option(g.object, g.id.split('-')[1]))
  subject.value = draft.careStudySubject
  subject.addEventListener('change', () => { draft.careStudySubject = subject.value as Settings['careStudySubject'] })
  const job = document.createElement('select')
  job.setAttribute('aria-label', '固定岗位')
  job.dataset.setting = 'careWorkId'
  job.add(new Option('自动选择（时薪优先）', ''))
  for (const g of allGoods('work')) job.add(new Option(`${g.name} · ${g.useTime}分钟 / ${g.yb}元宝`, g.id))
  if (draft.careWorkId && ![...job.options].some(o => o.value === draft.careWorkId)) job.add(new Option('原岗位已不可用，请重新选择', draft.careWorkId))
  job.value = draft.careWorkId
  job.addEventListener('change', () => { draft.careWorkId = job.value })
  const subjectRow = div('carePolicyRow', div('', '优先科目'), subject)
  const jobRow = div('carePolicyRow', div('', '固定岗位'), job)
  const policyHint = div('careHint')
  const describeMode = (): void => {
    draft.careTrainingMode = mode.value as Settings['careTrainingMode']
    subjectRow.hidden = jobRow.hidden = mode.value === 'balanced'
    policyHint.textContent = mode.value === 'balanced'
      ? '学习先推进最低学历阶段；打工优先补足较低属性。'
      : '主科毕业后换科；指定岗位不满足条件时等待，自动选岗按时薪优先。'
  }
  mode.addEventListener('change', describeMode)
  describeMode()
  const policy = div('carePolicy', div('carePolicyRow', div('', '培养方式'), mode), subjectRow, jobRow, policyHint)
  const farm = document.createElement('input')
  farm.type = 'checkbox'
  farm.checked = draft.careAutoFarm
  farm.dataset.setting = 'careAutoFarm'
  farm.setAttribute('aria-label', '农场自动照料')
  farm.addEventListener('change', () => { draft.careAutoFarm = farm.checked })
  const farmLabel = document.createElement('label')
  farmLabel.className = 'careToggle'
  farmLabel.append(farm, div('', '农场自动照料'))

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
    div('careHint', '培养方式只决定学习和打工的选择，每日目标完成后停止，次日续接。考试需手动；全科研究生毕业后继续日常学习。旅行仍随机。'),
    div('careHint', '农场打开或关闭时均可自动浇水、除草、杀虫，照料经验沿用原规则；不购买、播种、施肥、收获或铲除。操作宠物或面板时暂缓。'),
  )
  const error = div('careError')
  error.setAttribute('role', 'alert')
  const content = div(
    'sweetHeartCareSettings focusPress',
    div('careHeader', div('careTitle', '托管设置'), action('关闭', 'careClose', () => close())),
    div('careHint careNotice', '贴心宝贝已开启且未到期时，以下设置生效。'),
    care,
    div('careDaily', dailyLabel, policy, div('careHint', '空闲时执行，照料遵守上方限额；小游戏与考试需手动。')),
    div('careFarm', farmLabel, div('careHint', '自动浇水、除草、杀虫；不消耗肥料、不自动收获。')),
    rules,
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
