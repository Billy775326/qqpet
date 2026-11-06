import { BrowserWindow, screen } from 'electron'
import { hideOnFullscreen } from './fullscreen'
import { join } from 'node:path'
import { IPC, type Point } from '../shared/ipc'
import { APP_ORIGIN } from './protocol'

const SHELL_REVEAL_MARGIN_DIP = 3
const CURSOR_INTERVAL_MS = 16
const PAGES = process.env.ELECTRON_RENDERER_URL ?? APP_ORIGIN

// Keep the taskbar edge reachable and absorb native rounding at fractional DPI.
function overlayBounds(): Electron.Rectangle {
  const area = screen.getPrimaryDisplay().workArea
  const margin = SHELL_REVEAL_MARGIN_DIP
  return { x: area.x + margin, y: area.y + margin, width: Math.max(1, area.width - margin * 2), height: Math.max(1, area.height - margin * 2) }
}

/** Transparent, click-through overlay inside the primary display's work area. */
export function createPetWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...overlayBounds(),
    show: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  // Full-screen apps hide the pet: macOS keeps it off full-screen spaces, and
  // Linux window managers stack a focused full-screen window above it.
  win.setVisibleOnAllWorkspaces(true)
  win.setIgnoreMouseEvents(true)
  // On macOS, dock.hide() turns the process into a UI element, which hides
  // windows that are already visible.
  win.once('ready-to-show', () => {
    win.showInactive()
    if (process.platform === 'win32') hideOnFullscreen(win)
  })
  // The pet never navigates; links inside SWFs must not replace the page.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Click-through windows receive no mouse events on Linux, so the renderer
  // cannot hit-test on hover. Pushing the cursor position from here works the
  // same on every platform.
  let last: Point = { x: NaN, y: NaN }
  const timer = setInterval(() => {
    const c = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const p = { x: c.x - b.x, y: c.y - b.y }
    if (p.x === last.x && p.y === last.y) return
    last = p
    win.webContents.send(IPC.cursor, p)
  }, CURSOR_INTERVAL_MS)
  win.on('closed', () => clearInterval(timer))

  const workArea = (): void => {
    if (win.isDestroyed()) return
    const area = overlayBounds(), box = win.getBounds()
    if (['x', 'y', 'width', 'height'].some(key => area[key as keyof typeof area] !== box[key as keyof typeof box])) win.setBounds(area)
  }
  screen.on('display-metrics-changed', workArea)
  screen.on('display-added', workArea)
  screen.on('display-removed', workArea)
  win.on('closed', () => {
    screen.off('display-metrics-changed', workArea)
    screen.off('display-added', workArea)
    screen.off('display-removed', workArea)
  })
  void win.loadURL(`${PAGES}/index.html`)
  if (process.env.ELECTRON_RENDERER_URL) win.webContents.openDevTools({ mode: 'detach' })
  return win
}

/** A normal, resizable window playing one game; the SWF scales with it. */
export function openGameWindow(swf: string): BrowserWindow {
  const area = screen.getPrimaryDisplay().workAreaSize
  const scale = Math.min(1, (area.width * 0.9) / 1024, (area.height * 0.9) / 768)
  const win = new BrowserWindow({
    width: Math.round(1024 * scale),
    height: Math.round(768 * scale),
    useContentSize: true,
    backgroundColor: '#000',
    autoHideMenuBar: true,
    skipTaskbar: false,
    webPreferences: { sandbox: true },
  })
  // A hidden Windows launcher can suppress the constructor's initial show.
  win.once('ready-to-show', () => win.show())
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  void win.loadURL(`${PAGES}/game.html?swf=${encodeURIComponent(swf)}`)
  return win
}
