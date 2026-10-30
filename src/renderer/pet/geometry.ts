import { axisToCanvas, shapeMetrics, type PetMetrics, type PetRect } from '../../shared/pet-geometry'
import { info, mood, petSize, stage } from './store'

export { axisMax, axisFromCanvas, clampAxis } from '../../shared/pet-geometry'

export function petMetrics(): PetMetrics {
  const phase = stage()
  return shapeMetrics(`${info.sex}/${phase}${phase === 'Adult' ? `/${mood()}` : ''}`, petSize(), window.devicePixelRatio || 1)
}

export function petCanvasRect(): PetRect {
  const m = petMetrics()
  const left = axisToCanvas(info.lastX, innerWidth, m.extent, m.left, m.right)
  const top = axisToCanvas(info.lastY, innerHeight, m.extent, m.top, m.bottom)
  return { left, top, right: left + m.extent, bottom: top + m.extent, width: m.extent, height: m.extent }
}

export function petVisibleRect(): PetRect {
  const m = petMetrics(), box = petCanvasRect()
  return { left: box.left + m.left, top: box.top + m.top, right: box.left + m.right, bottom: box.top + m.bottom, width: m.right - m.left, height: m.bottom - m.top }
}
