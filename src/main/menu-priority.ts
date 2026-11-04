import type { BrowserWindow } from 'electron'

type MenuWindow = Pick<BrowserWindow, 'isFocusable' | 'isAlwaysOnTop' | 'setFocusable' | 'setAlwaysOnTop' | 'show' | 'moveTop' | 'focus'>

/** Raise tray popups together; only the last close restores the previous state. */
export function menuPriority(win: MenuWindow) {
  const owners = new Set<'menu' | 'state'>()
  let focusable = false
  let onTop = false
  const raise = (): void => {
    win.setFocusable(true)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.show()
    win.moveTop()
    win.focus()
  }
  const setOpen = (value: boolean, owner: 'menu' | 'state' = 'menu'): void => {
    if (value === owners.has(owner)) return
    if (value && !owners.size) { focusable = win.isFocusable(); onTop = win.isAlwaysOnTop() }
    if (value) owners.add(owner)
    else owners.delete(owner)
    if (value) raise()
    else if (!owners.size) {
      win.setFocusable(focusable)
      win.setAlwaysOnTop(onTop, 'screen-saver')
    }
  }
  return {
    get open() { return owners.size > 0 },
    setOpen,
    reveal(owner: 'menu' | 'state'): void {
      if (owners.has(owner)) raise()
      else setOpen(true, owner)
    },
  }
}
