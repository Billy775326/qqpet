import { RECHARGE_BOOST_CLICKS, RECHARGE_BOOST_RATE, RECHARGE_RATE, RECHARGE_TIERS, rechargedBalance } from '../../shared/recharge'
import { speak } from '../pet/pet'
import { info, setInfo } from '../pet/store'
import { openFrame } from './box'
import { button, div } from './dom'
import './css/recharge.css'
import './css/window.css'

let close: (() => void) | null = null
let redraw: (() => void) | null = null

export const closeRecharge = (): void => close?.()
export const refreshRecharge = (): void => redraw?.()

/** Local simulation only: no payment service or real purchase is involved. */
export function openRecharge(): void {
  if (close) return
  let selected: number = RECHARGE_TIERS[0]
  let rate = RECHARGE_RATE
  let boostClicks = 0
  let settled = false
  const balance = div('rechargeBalance')
  const hint = div('rechargeHint')
  const status = div('rechargeStatus')
  status.setAttribute('aria-live', 'polite')
  const grid = div('rechargeGrid')
  grid.setAttribute('role', 'radiogroup')
  grid.setAttribute('aria-label', '选择充值档位')
  const draw = (): void => {
    balance.textContent = `当前元宝：${info.yb}`
    status.classList.remove('rechargeError')
    status.textContent = `已选 ${selected} 元，可获得 ${selected * rate} 元宝`
    hint.textContent = `本地模拟充值 · 1 元 = ${rate} 元宝`
    for (const card of grid.children) {
      const tier = Number((card as HTMLElement).dataset.tier)
      const active = tier === selected
      card.querySelector('.rechargeGain')!.textContent = `${tier * rate} 元宝`
      card.classList.toggle('selected', active)
      card.setAttribute('aria-checked', String(active))
    }
  }
  grid.append(...RECHARGE_TIERS.map(tier => {
    const choose = (): void => {
      if (settled) return
      selected = tier
      if (tier === 648 && boostClicks < RECHARGE_BOOST_CLICKS && ++boostClicks === RECHARGE_BOOST_CLICKS) rate = RECHARGE_BOOST_RATE
      draw()
    }
    const card = button('rechargeTier focusPress', choose, div('rechargeAmount', `${tier} 元`), div('rechargeGain', `${tier * RECHARGE_RATE} 元宝`))
    card.dataset.tier = String(tier)
    card.setAttribute('role', 'radio')
    card.tabIndex = 0
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose() }
    })
    return card
  }))
  const view = div('windowView localRecharge', div('title', '元宝充值'), balance, grid, status, hint)
  view.setAttribute('role', 'dialog')
  view.setAttribute('aria-label', '元宝充值')
  view.setAttribute('aria-modal', 'true')
  const remove = openFrame(div('ui-window', view), 'pet/windowTip/alert/bg.png')
  const frame = view.closest('.boxFrame')!
  frame.classList.add('localRechargeFrame')
  const backdrop = div('localRechargeBackdrop', frame)
  backdrop.dataset.hit = ''
  document.body.append(backdrop)
  const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') dismiss() }
  const dismiss = (): void => {
    settled = true
    document.removeEventListener('keydown', escape)
    remove()
    backdrop.remove()
    close = redraw = null
  }
  close = dismiss
  redraw = draw
  document.addEventListener('keydown', escape)
  const cancel = button('windowViewBut', dismiss)
  cancel.setAttribute('role', 'button')
  cancel.setAttribute('aria-label', '关闭充值')
  cancel.title = '关闭充值'
  const submit = button('windowViewButSubmit', () => {
    if (settled) return
    const previous = info.yb
    const next = rechargedBalance(previous, selected, rate)
    if (next === null) {
      status.textContent = '元宝数量已达上限，暂时无法充值'
      status.classList.add('rechargeError')
      return
    }
    // A synchronous save must finish before the dialog can acknowledge success.
    settled = true
    try {
      setInfo('yb', next)
    } catch (error) {
      info.yb = previous
      settled = false
      status.textContent = '保存失败，元宝未增加，请检查目录权限后重试'
      status.classList.add('rechargeError')
      console.error('Could not save local recharge', error)
      return
    }
    dismiss()
    speak({ s: `[host]，${selected * rate} 元宝到账啦~`, now: true }, 'speak')
  })
  submit.setAttribute('role', 'button')
  submit.setAttribute('aria-label', '确认充值')
  submit.title = '确认充值'
  view.append(cancel, submit)
  draw()
}

/** Hit area over the original footer's 元宝 lettering. */
export function rechargeEntry(): HTMLElement {
  const entry = button('rechargeEntry focusPress', openRecharge)
  entry.title = '充值元宝'
  entry.setAttribute('role', 'button')
  entry.setAttribute('aria-label', '充值元宝')
  return entry
}
