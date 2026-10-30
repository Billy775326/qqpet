import type { Point } from '../../shared/ipc'
import { axisFromCanvas, clampAxis, petCanvasRect, petMetrics, petVisibleRect } from '../pet/geometry'
import { machine } from '../pet/pet'
import { fitPortrait } from '../pet/portrait'
import { busy, info, save, setInfo, stage } from '../pet/store'
import { div, img } from './dom'
import './css/edge-idle.css'

const WAIT_MIN = 20000
const WAIT_RANGE = 25000
const CRAWL_MS = 4400
const REST_MS = 6200
const NEAR_FLOOR = 2

interface Motion { started: number; duration: number; distance: number; x: number; canvasX: number; offset: number }

/** Temporary presentation only; the existing pet sequencer and tasks remain authoritative. */
export function createEdgeIdle(pet: HTMLElement, isMini: () => boolean) {
  const image = img('edge-idle-image', '')
  image.draggable = false
  image.alt = ''
  const artwork = div('edge-idle-art', image)
  const shell = div('edge-idle-shell', div('edge-idle-flipper back'), artwork, div('edge-idle-flipper front'))
  const root = div('edge-idle', shell)
  root.hidden = true
  root.setAttribute('aria-hidden', 'true')
  pet.append(root)
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let reserved = false
  let destroyed = false
  let query = 0
  let timer = 0
  let frame = 0
  let motion: Motion | null = null
  let cursor: Point = { x: -Infinity, y: -Infinity }

  function hovered(): boolean {
    const r = pet.getBoundingClientRect()
    return cursor.x >= r.left && cursor.x <= r.right && cursor.y >= r.top && cursor.y <= r.bottom
  }
  function eligible(): boolean {
    return !destroyed && reserved && !reducedMotion.matches && document.visibilityState !== 'hidden' &&
      save.havePet && !save.isBury && !save.settings.hidden && !save.settings.paused && info.health === 5 && !busy() &&
      !isMini() && machine.pose.a === 'normal' && !hovered() &&
      Math.abs(petVisibleRect().bottom - innerHeight) <= NEAR_FLOOR &&
      !document.querySelector('.boxFrame,.box,.ui-menu,.control.showControl')
  }
  function stop(commit = true): void {
    clearTimeout(timer)
    timer = 0
    cancelAnimationFrame(frame)
    frame = 0
    const previous = motion
    motion = null
    root.hidden = true
    delete pet.dataset.edgeIdle
    pet.style.translate = ''
    if (commit && previous?.offset && info.lastX === previous.x) {
      const m = petMetrics()
      const x = clampAxis(axisFromCanvas(previous.canvasX + previous.offset, innerWidth, m.extent, m.left, m.right), innerWidth, m.extent, m.left, m.right)
      try { setInfo('lastX', x) } catch (error) {
        info.lastX = previous.x
        window.dispatchEvent(new Event('resize'))
        console.error('Could not save taskbar motion position', error)
      }
    }
  }
  function tick(now: number): void {
    const current = motion
    if (!current) return
    if (!eligible()) { stop(); refresh(); return }
    const progress = Math.min(1, Math.max(0, (now - current.started) / current.duration))
    // Ease the first and final steps, with no save writes during animation frames.
    current.offset = current.distance * (0.5 - Math.cos(progress * Math.PI) / 2)
    pet.style.translate = `${current.offset}px 0px`
    if (progress >= 1) { stop(); refresh(); return }
    frame = requestAnimationFrame(tick)
  }
  function begin(): void {
    timer = 0
    if (!eligible()) return refresh()
    // Never hide the live SWF before its portrait has decoded.
    if (!image.complete || !image.naturalWidth) return refresh()
    const m = petMetrics()
    const body = petVisibleRect()
    const width = m.right - m.left
    const height = m.bottom - m.top
    const crawl = Math.random() < 0.5
    const direction = (body.left + body.right) / 2 < innerWidth / 2 ? 1 : -1
    const proneWidth = (width * Math.cos(70 * Math.PI / 180) + height * Math.sin(70 * Math.PI / 180)) * 0.9
    const center = Math.max(proneWidth / 2 + 4, Math.min((body.left + body.right) / 2, innerWidth - proneWidth / 2 - 4))
    const room = direction > 0 ? innerWidth - center - proneWidth / 2 - 8 : center - proneWidth / 2 - 8
    const distance = crawl ? direction * Math.max(0, Math.min(height * 0.8, room)) : 0
    const proneHeight = (width * Math.sin(70 * Math.PI / 180) + height * Math.cos(70 * Math.PI / 180)) * 0.9
    fitPortrait(image, info.sex + stage(), width, height)
    root.style.left = `${center - petCanvasRect().left}px`
    root.style.top = `${m.bottom - proneHeight / 2 - 3}px`
    root.style.setProperty('--edge-width', `${width}px`)
    root.style.setProperty('--edge-height', `${height}px`)
    root.style.setProperty('--edge-prone-height', `${proneHeight}px`)
    root.style.setProperty('--edge-direction', String(direction))
    root.dataset.mode = crawl ? 'crawl' : 'rest'
    pet.dataset.edgeIdle = root.dataset.mode
    root.hidden = false
    motion = { started: performance.now(), duration: crawl ? CRAWL_MS : REST_MS, distance, x: info.lastX, canvasX: petCanvasRect().left, offset: 0 }
    frame = requestAnimationFrame(tick)
  }
  function refresh(): void {
    if (!eligible()) return stop()
    const key = info.sex + stage()
    if (image.dataset.avatar !== key) {
      const m = petMetrics()
      fitPortrait(image, key, m.right - m.left, m.bottom - m.top)
      void image.decode().catch(error => console.warn('Could not preload taskbar portrait; retaining the live pet', error))
    }
    if (!motion && !timer) timer = window.setTimeout(begin, WAIT_MIN + Math.random() * WAIT_RANGE)
  }
  async function updateBoundary(): Promise<void> {
    stop(false)
    const request = ++query
    try {
      const value = await window.qqpet.hasBottomTaskbar?.()
      if (destroyed || request !== query) return
      reserved = value === true
      refresh()
    } catch (error) {
      if (destroyed || request !== query) return
      reserved = false
      console.warn('Could not determine taskbar boundary; skipping idle motion', error)
    }
  }
  function trackPointer(point: Point): void {
    cursor = point
    refresh()
  }
  const interrupt = (): void => { stop(); queueMicrotask(refresh) }
  const layout = (): void => { stop(false); refresh() }
  const visibility = (): void => { stop(); refresh() }
  document.addEventListener('pointerdown', interrupt, true)
  document.addEventListener('keydown', interrupt, true)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('qqpet:pose', refresh)
  window.addEventListener('qqpet:pet-layout', layout)
  window.addEventListener('resize', updateBoundary)
  reducedMotion.addEventListener('change', visibility)
  const observer = new MutationObserver(refresh)
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true })
  function destroy(): void {
    destroyed = true
    stop(false)
    observer.disconnect()
    root.remove()
    document.removeEventListener('pointerdown', interrupt, true)
    document.removeEventListener('keydown', interrupt, true)
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('qqpet:pose', refresh)
    window.removeEventListener('qqpet:pet-layout', layout)
    window.removeEventListener('resize', updateBoundary)
    window.removeEventListener('beforeunload', destroy)
    reducedMotion.removeEventListener('change', visibility)
  }
  window.addEventListener('beforeunload', destroy)
  void updateBoundary()
  return { get active() { return motion !== null }, refresh, trackPointer, interrupt, destroy }
}
