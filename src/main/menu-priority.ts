import type { BrowserWindow } from 'electron'

type MenuWindow = Pick<BrowserWindow, 'isFocusable' | 'isAlwaysOnTop' | 'setFocusable' | 'setAlwaysOnTop' | 'show' | 'moveTop' | 'focus'>

/** Temporarily raise HTML menus above the Windows tray overflow window. */
export function menuPriority(win: MenuWindow) {
  let open = false
  let focusable = false
  let onTop = false
  return {
    get open() { return open },
    setOpen(value: boolean): void {
      if (value === open) return
      if (value) { focusable = win.isFocusable(); onTop = win.isAlwaysOnTop() }
      open = value
      win.setFocusable(value || focusable)
      if (value) {
        win.setAlwaysOnTop(true, 'screen-saver')
        win.show()
        win.moveTop()
        win.focus()
      } else win.setAlwaysOnTop(onTop, 'screen-saver')
    },
  }
}
