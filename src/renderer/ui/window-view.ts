import type { Good } from '../pet/data/goods'
import { openFrame } from './box'
import './css/window.css'
import { button, div, img } from './dom'

interface Dialog {
  title?: string
  msg: string | (() => string | HTMLElement)
  goods?: Pick<Good, 'url' | 'name'>[]
  /** Quantity range 1..max (initially max); a live limit of 0 disables purchasing. */
  max?: number | (() => number)
  /** OK button; without it OK just closes. `num` is the picked quantity. */
  ok?: (close: () => void, num: number) => void
  /** The sweetheart skin. */
  sweet?: boolean
}

let closeCurrent = (): void => {}

/** The original's single "WindowView" alert: opening one replaces the previous. */
export function windowView(d: Dialog): void {
  closeCurrent()
  const limit = (): number => typeof d.max === 'function' ? d.max() : d.max ?? 1
  let num = limit()
  const count = div('content', String(num))
  const message = div('msg', typeof d.msg === 'function' ? d.msg() : d.msg)
  const main = div('main', message)
  let submit: HTMLDivElement
  let refreshQuantity = (): void => {}
  if (d.goods?.length)
    main.append(
      div(
        'goods',
        ...d.goods.map((g) =>
          Object.assign(div('goodImgBox', img('goodImg', g.url)), {
            title: g.name,
          }),
        ),
      ),
    )
  if (d.max !== undefined) {
    const controls: { element: HTMLButtonElement; delta: number }[] = []
    const step = (delta: number): void => {
      const max = limit()
      num = max > 0 ? Math.min(Math.max(num + delta, 1), max) : 0
      count.textContent = String(num)
      for (const { element, delta } of controls) element.disabled = delta < 0 ? num <= 1 : num >= max
      submit?.setAttribute('aria-disabled', String(max <= 0))
    }
    refreshQuantity = (): void => step(0)
    const adjust = (cls: string, delta: number, label: string): HTMLButtonElement => {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = `quantityButton ${cls}`
      if (Math.abs(delta) === 10) {
        const hint = img('quantityStepHint', `pet/shppingMall/${delta < 0 ? 'cut' : 'add'}.svg`)
        hint.alt = ''
        hint.setAttribute('aria-hidden', 'true')
        element.appendChild(hint)
      } else element.title = label
      element.setAttribute('aria-label', label)
      // Quantity controls must not start dragging the surrounding frame.
      element.addEventListener('pointerdown', (event) => event.stopPropagation())
      element.addEventListener('click', () => {
        refreshQuantity()
        if (element.disabled) return
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
        if (!reducedMotion) {
          element.animate([
            { transform: 'translateX(0) scale(1)' },
            { transform: `translateX(${Math.abs(delta) === 10 ? Math.sign(delta) * 3 : 0}px) scale(0.86)`, offset: 0.4 },
            { transform: 'translateX(0) scale(1)' },
          ], { duration: 200, easing: 'ease-out' })
        }
        step(delta)
        if (!reducedMotion) {
          const style = getComputedStyle(count)
          count.animate([
            { color: style.color, transform: 'scale(1)' },
            { color: style.getPropertyValue('--quantity-highlight').trim(), transform: 'scale(1.15)', offset: 0.4 },
            { color: style.color, transform: 'scale(1)' },
          ], { duration: 200, easing: 'ease-out' })
        }
      })
      controls.push({ element, delta })
      return element
    }
    main.append(
      div(
        'chooseNum fc',
        adjust('cutUpOver', -10, '−10（减少 10）'),
        adjust('cut', -1, '减少 1'),
        count,
        adjust('add', 1, '增加 1'),
        adjust('addUpOver', 10, '+10（增加 10）'),
      ),
    )
    step(0)
  }

  const view = div(d.sweet ? 'windowView sweetHeart' : 'windowView', ...(d.title ? [div('title', d.title)] : []), main)
  const closeFrame = openFrame(div('ui-window', view), d.sweet ? 'pet/windowTip/sweetHeart/sweetHeart.png' : 'pet/windowTip/alert/bg.png')
  let refresher: ReturnType<typeof setInterval> | undefined
  const close = (): void => {
    if (refresher !== undefined) clearInterval(refresher)
    closeFrame()
  }
  closeCurrent = close
  const refresh = (): void => {
    refreshQuantity()
    if (typeof d.msg === 'function') message.replaceChildren(d.msg())
  }
  submit = button('windowViewButSubmit', () => {
    const selected = num
    refresh()
    // A changed live limit requires reviewing the new quantity before confirming.
    if (d.max !== undefined && (num < 1 || num !== selected)) return
    if (d.ok) d.ok(close, num)
    else close()
  })
  view.append(button('windowViewBut', close), submit)
  refresh()
  if (typeof d.max === 'function' || typeof d.msg === 'function') {
    refresher = setInterval(() => {
      if (!view.isConnected) return close()
      refresh()
    }, 1000)
  }
}
