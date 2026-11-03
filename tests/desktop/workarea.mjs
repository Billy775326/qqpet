import { app, protocol, screen } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const directory = process.argv[2]
mkdirSync(join(directory,'profile'),{recursive:true})
app.setPath('userData', join(directory, 'profile'))
app.setPath('sessionData', join(directory, 'profile'))
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true}}])
const samples = []
app.whenReady().then(async () => {
  protocol.handle('app', () => new Response('<html><style>html,body{margin:0;background:transparent}</style></html>',{headers:{'Content-Type':'text/html'}}))
  const {createPetWindow} = await import(pathToFileURL(join(directory,'window.mjs')).href)
  const win = createPetWindow()
  let timer
  const deadline = setTimeout(() => win.close(), 35000)
  win.once('ready-to-show', () => {
    writeFileSync(join(directory,'ready.json'), JSON.stringify({processId:process.pid,handle:win.getNativeWindowHandle().readBigUInt64LE().toString()}))
    timer = setInterval(() => {
      if (win.isDestroyed()) return
      const phase = readFileSync(join(directory,'phase.txt'),'utf8').trim()
      const display = screen.getPrimaryDisplay()
      samples.push({at:Date.now(),phase,visible:win.isVisible(),bounds:win.getBounds(),contentBounds:win.getContentBounds(),workArea:display.workArea,scale:display.scaleFactor})
      if (samples.length > 1000) throw Error('Desktop probe exceeded its bounded sample budget')
    },100)
  })
  win.on('closed', () => {
    clearInterval(timer);clearTimeout(deadline)
    writeFileSync(join(directory,'samples.json'),JSON.stringify({samples},null,2))
  })
  app.on('window-all-closed',()=>app.quit())
}).catch(error=>{writeFileSync(join(directory,'error.txt'),String(error));console.error(error);app.exit(1)})
