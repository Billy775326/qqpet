import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type QQPetApi } from '../shared/ipc'

const send =
  (channel: string) =>
  (arg?: unknown): void =>
    ipcRenderer.send(channel, arg)

const api: QQPetApi = {
  load: () => ipcRenderer.invoke(IPC.load),
  keyStorage: () => ipcRenderer.invoke(IPC.keyStorage),
  save: (patch) => { const error = ipcRenderer.sendSync(IPC.save, patch); if (error) throw new Error(error) },
  resetPet: send(IPC.resetPet),
  exportSave: () => ipcRenderer.invoke(IPC.exportSave),
  importSave: send(IPC.importSave),
  openGame: send(IPC.openGame),
  calendar: () => ipcRenderer.invoke(IPC.calendar),
  aiModels: (c) => ipcRenderer.invoke(IPC.aiModels, c),
  aiChat: (c, messages) => ipcRenderer.invoke(IPC.aiChat, c, messages),
  weather: (city) => ipcRenderer.invoke(IPC.weather, city),
  quit: send(IPC.quit),
  messageBox: (options) => ipcRenderer.invoke(IPC.messageBox, options),
  copyText: send(IPC.copyText),
  showTrayMenu: send(IPC.showTrayMenu),
  setMenuOpen: send(IPC.setMenuOpen),
  hasBottomTaskbar: () => ipcRenderer.invoke(IPC.bottomTaskbar),
  setClickThrough: send(IPC.setClickThrough),
  setAlwaysOnTop: send(IPC.setAlwaysOnTop),
  setFocusable: send(IPC.setFocusable),
  setAutoStart: send(IPC.setAutoStart),
  setTrayState: send(IPC.setTrayState),
  onCursor: (listener) => ipcRenderer.on(IPC.cursor, (_e, p) => listener(p)),
  onTrayClick: (listener) => ipcRenderer.on(IPC.trayClick, (_e, c) => listener(c)),
  onGamePlayed: (listener) => ipcRenderer.on(IPC.gamePlayed, (_e, m) => listener(m)),
  onClipboard: (listener) => ipcRenderer.on(IPC.clipboard, (_e, text) => listener(text)),
}

contextBridge.exposeInMainWorld('qqpet', api)
