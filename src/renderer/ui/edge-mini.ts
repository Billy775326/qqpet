import { axisFromCanvas, clampAxis, petMetrics, petVisibleRect } from '../pet/geometry'
import { busy, info, save, setInfo, stage } from '../pet/store'
import { div, img } from './dom'
import './css/edge-mini.css'

interface Point { x: number; y: number }
type EdgeSide = 'left' | 'right'
interface MiniActions {
  closeMenu: () => void
  collapseControls: () => void
  layout: () => void
  showControls: () => void
  openContextMenu: (point: Point) => void
}
export interface EdgeMini {
  readonly active: boolean
  refresh: () => void
  trackPointer: (point: Point) => void
  enter: (side?: EdgeSide) => void
  expand: (point?: Point) => void
  destroy: () => void
}

const PREF = 'qqpet.edge-mini.v1'
const WIDTH = 72
const HEIGHT = 80
const VISIBLE = 36
const PEEK_VISIBLE = 64
const SLEEP_MS = 180000
// Alpha bounds of the existing 400 x 400 portrait assets, in source pixels.
const AVATARS: Record<string, readonly [number, number, number, number]> = {
  GGEgg: [115, 123, 278, 340], GGKid: [100, 144, 291, 341], GGAdult: [104, 148, 296, 341],
  MMEgg: [115, 122, 278, 340], MMKid: [99, 123, 293, 341], MMAdult: [104, 115, 296, 340],
}
let current: EdgeMini | undefined

/** Restore the full pet before a tray/settings action targets it. */
export function expandEdgeMini(): boolean {
  if (!current?.active) return false
  current.expand()
  return true
}

/** A presentation state: docking and visual sleep never stop or mutate the simulation. */
export function createEdgeMini(actions: MiniActions): EdgeMini {
  current?.destroy()
  let active = false
  let side: EdgeSide = 'right'
  let peeking = false
  let sleeping = false
  let sleepTimer = 0
  let drag: { id: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null = null
  const image = img('local-mini-portrait', '')
  image.draggable = false
  image.alt = ''
  const zzz = div('local-mini-zzz', 'Z z')
  zzz.setAttribute('aria-hidden', 'true')
  const widget = div('local-edge-mini', div('local-mini-artwork', image), zzz)
  widget.dataset.hit = ''
  widget.setAttribute('role', 'button')
  widget.setAttribute('aria-label', '展开宠物')
  widget.tabIndex = 0
  widget.hidden = true
  document.body.append(widget)

  function remember(): void {
    try {
      if (active) localStorage.setItem(PREF, JSON.stringify({ version: 1, side }))
      else localStorage.removeItem(PREF)
    } catch (error) {
      console.warn('Could not persist edge mini preference; using this session only', error)
    }
  }
  function stopSleep(): void {
    window.clearTimeout(sleepTimer)
    sleepTimer = 0
  }
  const canDock = (): boolean => save.havePet && !save.isBury && info.health > 0 && !save.settings.hidden
  const canSleep = (): boolean => active && canDock() && !busy() && info.health === 5 && !peeking && !drag && !document.querySelector('.boxFrame,.box')
  function paint(): void {
    widget.dataset.mode = peeking ? 'peek' : sleeping ? 'mini-sleep' : 'mini'
    widget.title = sleeping ? '宠物小憩中，移入鼠标唤醒，点击展开' : '点击展开宠物，也可以拖离屏幕边缘'
  }
  function refresh(): void {
    widget.dataset.side = side
    if (active && (!save.havePet || save.isBury || info.health <= 0)) {
      active = peeking = sleeping = false
      remember()
    }
    if (document.body.classList.contains('qqpet-edge-mini') !== active) document.body.classList.toggle('qqpet-edge-mini', active)
    widget.hidden = !active || save.settings.hidden
    if (widget.hidden) {
      stopSleep()
      sleeping = false
      return
    }
    const key = info.sex + stage()
    if (image.dataset.avatar !== key) {
      const [left, top, right, bottom] = AVATARS[key]
      const scale = Math.min(64 / (right - left), 64 / (bottom - top))
      image.src = `pet/avatar/${key}.png`
      image.dataset.avatar = key
      Object.assign(image.style, {
        width: `${400 * scale}px`, height: `${400 * scale}px`,
        left: `${(WIDTH - (right - left) * scale) / 2 - left * scale}px`,
        top: `${(HEIGHT - (bottom - top) * scale) / 2 - top * scale}px`,
      })
    }
    if (!drag) {
      const body = petVisibleRect()
      widget.style.top = `${Math.max(8, Math.min((body.top + body.bottom - HEIGHT) / 2, innerHeight - HEIGHT - 8))}px`
      widget.style[side] = `${-(WIDTH - (peeking ? PEEK_VISIBLE : VISIBLE))}px`
      widget.style[side === 'left' ? 'right' : 'left'] = 'auto'
    }
    if (!canSleep()) {
      stopSleep()
      sleeping = false
    } else if (!sleepTimer && !sleeping) {
      sleepTimer = window.setTimeout(() => {
        sleepTimer = 0
        if (canSleep()) { sleeping = true; paint() }
      }, SLEEP_MS)
    }
    paint()
  }
  function setPeek(on: boolean): void {
    if (!active || save.settings.hidden || drag || peeking === on) return
    peeking = on
    sleeping = false
    stopSleep()
    refresh()
  }
  function trackPointer(point: Point): void {
    if (!active || save.settings.hidden || drag) return
    const top = parseFloat(widget.style.top)
    const distance = side === 'left' ? point.x : innerWidth - point.x
    setPeek(distance >= -4 && distance <= (peeking ? 112 : 72) && point.y >= top - 16 && point.y <= top + HEIGHT + 16)
  }
  function enter(edge: EdgeSide = 'right'): void {
    if (!canDock() || active) return
    actions.closeMenu()
    actions.collapseControls()
    side = edge
    active = true
    peeking = sleeping = false
    remember()
    refresh()
  }
  function expand(point?: Point): void {
    if (!active) return
    active = peeking = sleeping = false
    stopSleep()
    remember()
    refresh()
    const m = petMetrics()
    const x = point ? point.x - (m.left + m.right) / 2 : side === 'left' ? 12 - m.left : innerWidth - m.right - 12
    setInfo('lastX', clampAxis(axisFromCanvas(x, innerWidth, m.extent, m.left, m.right), innerWidth, m.extent, m.left, m.right))
    if (point) setInfo('lastY', clampAxis(axisFromCanvas(point.y - (m.top + m.bottom) / 2, innerHeight, m.extent, m.top, m.bottom), innerHeight, m.extent, m.top, m.bottom))
    actions.layout()
    actions.showControls()
  }
  widget.addEventListener('pointerenter', () => setPeek(true))
  widget.addEventListener('pointerleave', event => trackPointer(event))
  widget.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand() }
  })
  widget.addEventListener('contextmenu', event => {
    event.preventDefault()
    expand()
    actions.openContextMenu({ x: Math.max(10, Math.min(event.clientX, innerWidth - 10)), y: event.clientY })
  })
  widget.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return
    event.preventDefault()
    const rect = widget.getBoundingClientRect()
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false }
    stopSleep()
    sleeping = false
    widget.classList.add('local-mini-dragging')
    widget.setPointerCapture(event.pointerId)
    paint()
  })
  widget.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8 && !drag.moved) return
    drag.moved = true
    const left = Math.max(side === 'left' ? VISIBLE - WIDTH : 8, Math.min(event.clientX - drag.dx, side === 'right' ? innerWidth - VISIBLE : innerWidth - WIDTH - 8))
    if (side === 'left') widget.style.left = `${left}px`
    else widget.style.right = `${innerWidth - left - WIDTH}px`
    widget.style.top = `${Math.max(8, Math.min(event.clientY - drag.dy, innerHeight - HEIGHT - 8))}px`
  })
  function finishDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.id) return
    const moved = drag.moved
    const rect = widget.getBoundingClientRect()
    drag = null
    widget.classList.remove('local-mini-dragging')
    if (widget.hasPointerCapture(event.pointerId)) widget.releasePointerCapture(event.pointerId)
    if (event.type !== 'pointerup') return refresh()
    if (!moved) return expand()
    const point = { x: rect.left + WIDTH / 2, y: rect.top + HEIGHT / 2 }
    if (side === 'left' ? point.x > 56 : point.x < innerWidth - 56) return expand(point)
    const m = petMetrics()
    setInfo('lastY', clampAxis(axisFromCanvas(point.y - (m.top + m.bottom) / 2, innerHeight, m.extent, m.top, m.bottom), innerHeight, m.extent, m.top, m.bottom))
    peeking = false
    refresh()
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) widget.addEventListener(type, finishDrag)
  window.addEventListener('qqpet:pose', refresh)
  document.addEventListener('visibilitychange', refresh)
  const observer = new MutationObserver(refresh)
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true })
  function destroy(): void {
    stopSleep()
    observer.disconnect()
    window.removeEventListener('qqpet:pose', refresh)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('beforeunload', destroy)
    document.body.classList.remove('qqpet-edge-mini')
    widget.remove()
    if (current === controller) current = undefined
  }
  window.addEventListener('beforeunload', destroy)
  const controller: EdgeMini = { get active() { return active }, refresh, trackPointer, enter, expand, destroy }
  current = controller
  try {
    const preference = localStorage.getItem(PREF)
    const parsed = preference && JSON.parse(preference)
    if (parsed?.version === 1 && (parsed.side === 'left' || parsed.side === 'right') && save.havePet && !save.isBury && info.health > 0) {
      side = parsed.side
      active = true
    }
  } catch (error) {
    console.warn('Could not read edge mini preference; showing the full pet', error)
  }
  refresh()
  return controller
}
