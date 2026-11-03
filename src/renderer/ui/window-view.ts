import type { Good } from '../pet/data/goods'
import { openFrame } from './box'
import './css/window.css'
import { button, div, img } from './dom'

interface Dialog {
  title?: string
  msg: string
  goods?: Pick<Good, 'url' | 'name'>[]
  /** Shows a quantity picker from 1 to max (initially max). */
  max?: number
  /** OK button; without it OK just closes. `num` is the picked quantity. */
  ok?: (close: () => void, num: number) => void
  /** The sweetheart skin. */
  sweet?: boolean
}

let closeCurrent = (): void => {}

/** The original's single "WindowView" alert: opening one replaces the previous. */
export function windowView(d: Dialog): void {
  closeCurrent()
  let num = d.max ?? 1
  const count = div('content', String(num))

  const main = div('main', div('msg', d.msg))
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
    const max = d.max
    const controls: { element: HTMLButtonElement; delta: number }[] = []
    const step = (delta: number): void => {
      num = Math.min(Math.max(num + delta, 1), max)
      count.textContent = String(num)
      for (const { element, delta } of controls) element.disabled = delta < 0 ? num <= 1 : num >= max
    }
    const adjust = (cls: string, delta: number, label: string): HTMLButtonElement => {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = `quantityButton ${cls}`
      element.title = label
      element.setAttribute('aria-label', label)
      // Quantity controls must not start dragging the surrounding frame.
      element.addEventListener('pointerdown', (event) => event.stopPropagation())
      element.addEventListener('click', () => {
        if (element.disabled) return
        if (!Number.isFinite(delta) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          element.animate([
            { transform: 'translateX(0) scale(1)' },
            { transform: `translateX(${Math.sign(delta) * 3}px) scale(0.86)`, offset: 0.4 },
            { transform: 'translateX(0) scale(1)' },
          ], { duration: 200, easing: 'ease-out' })
        }
        step(delta)
      })
      controls.push({ element, delta })
      return element
    }
    main.append(
      div(
        'chooseNum fc',
        adjust('cutUpOver', -Infinity, '选择最小数量'),
        adjust('cutUp', -10, '减少 10'),
        adjust('cut', -1, '减少 1'),
        count,
        adjust('add', 1, '增加 1'),
        adjust('addUp', 10, '增加 10'),
        adjust('addUpOver', Infinity, '选择最大数量'),
      ),
    )
    step(0)
  }

  const view = div(d.sweet ? 'windowView sweetHeart' : 'windowView', ...(d.title ? [div('title', d.title)] : []), main)
  const close = openFrame(div('ui-window', view), d.sweet ? 'pet/windowTip/sweetHeart/sweetHeart.png' : 'pet/windowTip/alert/bg.png')
  closeCurrent = close
  view.append(
    button('windowViewBut', close),
    button('windowViewButSubmit', () => (d.ok ? d.ok(close, num) : close())),
  )
}
