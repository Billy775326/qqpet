// Alpha bounds of the existing 400 x 400 portrait assets, in source pixels.
const BOUNDS: Record<string, readonly [number, number, number, number]> = {
  GGEgg: [115, 123, 278, 340], GGKid: [100, 144, 291, 341], GGAdult: [104, 148, 296, 341],
  MMEgg: [115, 122, 278, 340], MMKid: [99, 123, 293, 341], MMAdult: [104, 115, 296, 340],
}

export function fitPortrait(image: HTMLImageElement, key: string, width: number, height: number): void {
  const [left, top, right, bottom] = BOUNDS[key]
  const scale = Math.min(width / (right - left), height / (bottom - top))
  if (image.dataset.avatar !== key) {
    image.src = `pet/avatar/${key}.png`
    image.dataset.avatar = key
  }
  Object.assign(image.style, {
    width: `${400 * scale}px`, height: `${400 * scale}px`,
    left: `${(width - (right - left) * scale) / 2 - left * scale}px`,
    top: `${(height - (bottom - top) * scale) / 2 - top * scale}px`,
  })
}
