import { canBuyCareFood, careFoods } from '../pet/care'
import { price } from '../pet/items'
import { save, update } from '../pet/store'
import { openFrame } from './box'
import { div } from './dom'
import './css/care-settings.css'

let closeCurrent = (): void => {}

/** Draft changes are saved together; closing/canceling leaves the current policy intact. */
export function openCareSettings(): void {
  closeCurrent()
  const draft = {
    careHungerPercent: save.settings.careHungerPercent ?? 60,
    careFoodId: save.settings.careFoodId ?? '',
    careAutoBuy: save.settings.careAutoBuy ?? false,
  }
  const action = (label: string, cls: string, run: () => void): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = cls
    b.textContent = label
    b.addEventListener('click', run)
    return b
  }
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '1'
  slider.max = '100'
  slider.step = '1'
  slider.value = String(draft.careHungerPercent)
  slider.setAttribute('aria-label', '自动喂食饥饿值限额')
  const threshold = div('careThreshold')
  const describeThreshold = (): void => {
    threshold.textContent = `${slider.value}%（当前约 ${Math.round(save.petComputedlInfo.hungerMax * Number(slider.value) / 100)}）`
  }
  slider.addEventListener('input', () => {
    draft.careHungerPercent = Number(slider.value)
    describeThreshold()
  })
  describeThreshold()

  const food = document.createElement('select')
  food.setAttribute('aria-label', '自动投喂食物')
  food.add(new Option('自动选择（优先使用背包）', ''))
  for (const g of careFoods()) {
    const purchasable = canBuyCareFood(g)
    const status = g.num ? `背包 ${g.num} 份` : purchasable ? `${price(g)} 元宝/份` : '暂不可购买'
    const option = new Option(`${g.name} · 饥饿 +${g.hunger} · ${status}`, g.id)
    option.disabled = !g.num && !purchasable
    food.add(option)
  }
  if (draft.careFoodId && !Array.from(food.options).some(o => o.value === draft.careFoodId))
    food.add(new Option('原选择已不可用，请重新选择', draft.careFoodId))
  food.value = draft.careFoodId
  food.addEventListener('change', () => { draft.careFoodId = food.value })

  const autoBuy = document.createElement('input')
  autoBuy.type = 'checkbox'
  autoBuy.checked = draft.careAutoBuy
  autoBuy.setAttribute('aria-label', '自动购买食物')
  autoBuy.addEventListener('change', () => { draft.careAutoBuy = autoBuy.checked })
  const toggle = document.createElement('label')
  toggle.className = 'careToggle'
  toggle.append(autoBuy, div('', '自动购买食物'))
  const error = div('careError')
  error.setAttribute('role', 'alert')
  const section = (title: string, ...children: (Node | string)[]): HTMLElement => div('careSection', div('careLabel', title), ...children)
  const content = div(
    'sweetHeartCareSettings focusPress',
    div('careHeader', div('careTitle', '托管设置'), action('关闭', 'careClose', () => close())),
    section('自动喂食限额', div('careHint', '饥饿值低于上限的以下比例时喂食。'), div('careRange', slider, threshold)),
    section('自动投喂食物', food, div('careHint', '指定食物后仅使用该食物；自动选择时优先使用背包食物。')),
    section('库存不足时', toggle, div('careHint', '开启后按需购买一份，消耗元宝；自动选择时购买当前可买的最低单价食物。')),
    div('careHint careNotice', '设置仅在贴心宝贝已开启且未到期时生效。'),
    error,
    div('careActions', action('取消', 'careCancel', () => close()), action('保存设置', 'careSave', () => {
      const previous = { careHungerPercent: save.settings.careHungerPercent, careFoodId: save.settings.careFoodId, careAutoBuy: save.settings.careAutoBuy }
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
