interface Rectangle { x: number; y: number; width: number; height: number }

/** A reserved bottom strip is a taskbar/dock boundary, rather than a bare screen edge. */
export function hasBottomTaskbar(bounds: Rectangle, workArea: Rectangle): boolean {
  return bounds.y + bounds.height > workArea.y + workArea.height
}
