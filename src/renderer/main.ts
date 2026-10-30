import { axisMax, axisFromCanvas, clampAxis, petCanvasRect, petMetrics, petVisibleRect } from './pet/geometry'
import { clipAsk } from './pet/ai'
import { resumeTask } from './pet/jobs'
import { speak, startPet } from './pet/pet'
import { info, onInfoChange, petSize, save, setInfo } from './pet/store'
import { adopt } from './ui/adopt'
import { collapseControls, scheduleHide, showControl } from './ui/control'
import { createEdgeMini, type EdgeMini } from './ui/edge-mini'
import { div, touch } from './ui/dom'
import './ui/face'
import { closeMenu, openMenu, runTrayAction, trackMenuPointer } from './ui/menu'
import { openState } from './ui/state'

const petEl = document.getElementById('pet')!
const HOLD_MS = 500
let mini: EdgeMini | undefined

function clampPosition(snap = false): void {
  const m = petMetrics()
  setInfo('lastX', clampAxis(info.lastX, innerWidth, m.extent, m.left, m.right, snap))
  setInfo('lastY', clampAxis(info.lastY, innerHeight, m.extent, m.top, m.bottom, snap))
}
let size = petSize()
let layoutWidth = innerWidth
let layoutHeight = innerHeight
let layingOut = false
function layout(): void {
  if (layingOut) return
  layingOut = true
  try {
    const next = petSize()
    if (next !== size || layoutWidth !== innerWidth || layoutHeight !== innerHeight) {
      const oldMaxX = axisMax(layoutWidth, size)
      const oldMaxY = axisMax(layoutHeight, size)
      const right = oldMaxX > 0 && info.lastX >= oldMaxX - 0.5
      const bottom = oldMaxY > 0 && info.lastY >= oldMaxY - 0.5
      const left = info.lastX <= 0.5
      const top = info.lastY <= 0.5
      const shift = (next - size) / 2
      size = next
      layoutWidth = innerWidth
      layoutHeight = innerHeight
      setInfo('lastX', right ? axisMax(innerWidth, next) : left ? 0 : Math.max(0, Math.min(info.lastX - shift, axisMax(innerWidth, next))))
      setInfo('lastY', bottom ? axisMax(innerHeight, next) : top ? 0 : Math.max(0, Math.min(info.lastY - shift, axisMax(innerHeight, next))))
    }
    const rect = petCanvasRect()
    petEl.style.width = petEl.style.height = `${size}px`
    petEl.style.left = `${rect.left}px`
    petEl.style.top = `${rect.top}px`
  } finally {
    layingOut = false
  }
  mini?.refresh()
  window.dispatchEvent(new Event('qqpet:pet-layout'))
}
if (info.lastX < 0 || info.lastY < 0) {
  setInfo('lastX', (innerWidth - size) / 2)
  setInfo('lastY', (innerHeight - size) / 2)
}
clampPosition()
layout()
onInfoChange((key) => {
  if (['lastX', 'lastY', 'growth', 'mood', 'sex'].includes(key)) {
    layout()
    if (key === 'growth') queueMicrotask(layout)
  }
})
window.addEventListener('resize', layout)

const cursor = { x: 0, y: 0 }
window.API = {
  GetCursorPosition: () => `${cursor.x},${cursor.y},0`,
  GetWindowRect: () => {
    const r = petCanvasRect()
    return `${r.left},${r.top},${size},${size}`
  },
}

// The window is click-through except while the cursor is over a [data-hit]
// element (or a drag is in progress).
let interactive = false
let dragging = false
mini = createEdgeMini({
  closeMenu, collapseControls, layout, showControls: showControl,
  openContextMenu: point => openMenu({ ...point, pet: true }, adoptPet),
})
window.qqpet.onCursor((p) => {
  cursor.x = p.x
  cursor.y = p.y
  mini?.trackPointer(p)
  const target = document.elementFromPoint(p.x, p.y)
  trackMenuPointer(target)
  const hit = dragging || target?.isConnected === true && target.closest('[data-hit]') != null
  if (hit === interactive) return
  interactive = hit
  window.qqpet.setClickThrough(!hit)
  requestAnimationFrame(() => document.documentElement.classList.toggle('qqpet-cursor-hit', interactive))
})

petEl.addEventListener('contextmenu', (e) => openMenu({ x: e.clientX, y: e.clientY, pet: true }, adoptPet))

petEl.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0 || dragging || (e.target as HTMLElement).classList.contains('point')) return
  closeMenu()
  showControl()
  dragging = true
  const rect = petEl.getBoundingClientRect()
  const dx = e.clientX - rect.left
  const dy = e.clientY - rect.top
  const hold = touch ? setTimeout(() => openMenu({ x: e.clientX, y: e.clientY, pet: true }, adoptPet), HOLD_MS) : 0
  let moved = false
  const move = (m: PointerEvent) => {
    if (m.pointerId !== e.pointerId) return
    if (Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) >= 8) {
      moved = true
      clearTimeout(hold)
    }
    const frame = petMetrics()
    const x = axisFromCanvas(m.clientX - dx, innerWidth, frame.extent, frame.left, frame.right)
    const y = axisFromCanvas(m.clientY - dy, innerHeight, frame.extent, frame.top, frame.bottom)
    setInfo('lastX', clampAxis(x, innerWidth, frame.extent, frame.left, frame.right, true))
    setInfo('lastY', clampAxis(y, innerHeight, frame.extent, frame.top, frame.bottom, true))
  }
  petEl.setPointerCapture(e.pointerId)
  petEl.addEventListener('pointermove', move)
  const finish = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== e.pointerId) return
    clearTimeout(hold)
    dragging = false
    petEl.removeEventListener('pointermove', move)
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) petEl.removeEventListener(type, finish)
    if (petEl.hasPointerCapture(e.pointerId)) petEl.releasePointerCapture(e.pointerId)
    clampPosition(true)
    if (event.type === 'pointerup' && moved) {
      const body = petVisibleRect()
      if (body.left <= 0.75) mini?.enter('left')
      else if (body.right >= innerWidth - 0.75) mini?.enter('right')
    }
    scheduleHide()
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) petEl.addEventListener(type, finish)
})

// Touch has no hover to show a tooltip by: a long press shows it, and the lift is not a tap.
if (touch) {
  const tip = div('touchTip')
  const eat = (c: MouseEvent): void => c.stopPropagation()
  document.addEventListener(
    'pointerdown',
    (e) => {
      tip.remove()
      const text = (e.target as Element).closest('[title]')?.getAttribute('title')
      if (!text) return
      const hold = setTimeout(() => {
        tip.textContent = text
        tip.style.left = `${Math.min(Math.max(e.clientX, 110), innerWidth - 110)}px`
        tip.style.top = `${e.clientY}px`
        document.body.append(tip)
      }, HOLD_MS)
      const off = new AbortController()
      const signal = { signal: off.signal }
      const end = (): void => {
        clearTimeout(hold)
        off.abort()
      }
      document.addEventListener(
        'pointermove',
        (m) => {
          if (Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) > 8) end()
        },
        signal,
      )
      document.addEventListener('pointercancel', end, signal)
      document.addEventListener(
        'pointerup',
        () => {
          end()
          if (!tip.isConnected) return
          document.addEventListener('click', eat, true)
          setTimeout(() => document.removeEventListener('click', eat, true))
        },
        signal,
      )
    },
    true,
  )
}

const begin = (): void => {
  petEl.hidden = false
  startPet()
}
const adoptPet = (): void => adopt(begin)

// Linux trays report no position; their menus live at the top of the screen.
window.qqpet.onTrayClick((c) => {
  if (c.kind === 'action') { if (c.action) runTrayAction(c.action, adoptPet); return }
  const x = c.x ?? innerWidth - 60
  const y = c.y ?? 0
  if (c.kind === 'menu') openMenu({ x, y, pet: false }, adoptPet)
  else if (save.havePet) openState(x, y)
  else adoptPet()
})

const CLIP_MAX = 60
window.qqpet.onClipboard((text) => {
  if (save.havePet) speak({ s: text.length > CLIP_MAX ? `${text.slice(0, CLIP_MAX)}…` : text, b: '当前复制的文字', now: true, ai: clipAsk(text) }, 'speak')
})

if (save.havePet) {
  resumeTask()
  begin()
} else adoptPet()
