import { app, dialog } from 'electron'
import { mkdirSync, accessSync, constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const portable = process.platform === 'win32' && app.isPackaged
if (portable) {
  try {
    const data = resolve(dirname(process.execPath), 'data')
    mkdirSync(data, { recursive: true })
    accessSync(data, constants.W_OK)
    app.setPath('userData', data)
    for (const [key, folder] of [['sessionData', 'browser'], ['temp', 'temp'], ['crashDumps', 'crashes']] as const) {
      const path = join(data, folder)
      mkdirSync(path, { recursive: true })
      app.setPath(key, path)
    }
    app.setAppLogsPath(join(data, 'logs'))
    process.env.TEMP = process.env.TMP = process.env.TMPDIR = app.getPath('temp')
  } catch (error) {
    dialog.showErrorBox('便携版目录不可写', `请将 ZIP 解压到有写入权限的目录后运行。\n${error}`)
    app.exit(1)
    throw error
  }
}
