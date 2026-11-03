const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')

const profile = mkdtempSync(resolve('dist/display-matrix-profile-'))
app.setPath('userData', profile); app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
const disk = {
  petInfo: { yb: 5000, sex: 'GG', growth: 0, faceClick: 0, health: 5, lastX: 100, lastY: 100 },
  settings: { hd: false, opacity: 1, faceClick: 0, quiet: false, clip: false, aiUrl: '', aiKey: '', aiModel: '', weatherCity: '' },
  petComputedlInfo: { level: 1 },
  selfGoodDatas: { food: [], clean: [], medicine: [], toy: [], nums: [], background: [] },
  selfGoodUseOption: { background: null },
}
ipcMain.handle('fixture:load', () => structuredClone(disk))
ipcMain.on('fixture:save', (event, patch) => {
  for (const [key, value] of Object.entries(patch)) Object.assign(disk[key], value)
  event.returnValue = null
})
ipcMain.handle('fixture:question', () => 0)
ipcMain.handle('fixture:export', () => false)
ipcMain.on('fixture:import', () => {})
ipcMain.on('fixture:reset', () => {})
ipcMain.handle('fixture:models', () => [])
ipcMain.handle('fixture:chat', () => 'isolated reply')

const resolutions = [[1280,720],[1366,768],[1920,1080],[2560,1440],[3840,2160],[3440,1440],[2560,1080],[1080,1920]]
const scales = [1,1.25,1.5,1.75,2,2.5,3]
const taskbars = ['hidden','bottom','top','left','right']
const cases = resolutions.flatMap(([physicalWidth,physicalHeight]) => scales.flatMap(scale => taskbars.map(taskbar => {
  const fullWidth = Math.floor(physicalWidth / scale), fullHeight = Math.floor(physicalHeight / scale)
  const reserved = taskbar === 'hidden' ? 0 : 48
  return {
    physicalWidth, physicalHeight, scale, taskbar,
    x: 3 + (taskbar === 'left' ? reserved : 0), y: 3 + (taskbar === 'top' ? reserved : 0),
    width: fullWidth - 6 - (taskbar === 'left' || taskbar === 'right' ? reserved : 0),
    height: fullHeight - 6 - (taskbar === 'bottom' || taskbar === 'top' ? reserved : 0),
  }
})))
app.on('window-all-closed', () => {})
const results = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const rectCode = "e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}"
function fits(rect, sample, name, margin = 0) {
  assert.ok(rect && rect.width > 0 && rect.height > 0 &&
    rect.x >= margin - .5 && rect.y >= margin - .5 &&
    rect.right <= sample.width - margin + .5 && rect.bottom <= sample.height - margin + .5,
    name + ' exceeds work area: ' + JSON.stringify({ sample, rect }))
}

app.whenReady().then(async () => {
  const views = process.env.QQPET_DISPLAY_VIEWS?.split(',') ?? ['menu','setup','shop','controls','mini']
  assert.ok(views.every(view=>['menu','setup','shop','controls','mini'].includes(view)), 'Unknown display matrix view')
  for (const view of views) {
    const prepared = JSON.parse(readFileSync('dist/ui-' + (view === 'setup' ? 'shop' : view) + '-prepared.json', 'utf8'))
    const usesStore = view === 'shop' || view === 'setup'
    const win = new BrowserWindow({
      width: 1000, height: 700, useContentSize: true, show: false,
      webPreferences: { ...(usesStore ? { preload: join(__dirname, 'setup-preload.cjs') } : {}),
        sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false },
    })
    win.webContents.on('console-message', event => { if(event.level === 'error' || event.level === 3) console.error(view, event.message) })
    const evaluate = code => win.webContents.executeJavaScript(code)
    const assetRoot = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
    const html = resolve('dist/display-matrix-' + view + '.html')
    const css = prepared.css.replaceAll('url(/pet/', 'url(' + assetRoot + 'pet/')
    writeFileSync(html, '<!doctype html><head><meta charset="utf-8"><base href="' + assetRoot + '"><style>' + css + '</style></head><body>' + ((view === 'mini' || view === 'menu') ? '<div id="pet" data-hit=""></div>' : '') + '</body>')
    await win.loadFile(html)
    await resizeViewport(win, 1000, 700, 1)
    const boot = (prepared.setup || '') + '\n' + prepared.code
    if (usesStore) await evaluate('(async()=>{' + boot + ';return true})()')
    else await evaluate(boot + ';true')
    try {
      for (const sample of cases) {
        try {
          await resizeViewport(win, sample.width, sample.height, sample.scale)
          if (view === 'menu') {
            await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.hide();fixture.open(innerWidth+20,innerHeight+20)")
            await pause(20)
            fits(await evaluate('(' + rectCode + ')(document.querySelector(".rightMenu"))'), sample, 'tray menu')
          } else if (view === 'setup') {
            await evaluate('fixture.closeSetup();fixture.openSetup()')
            await pause(20)
            for (const tab of ['全局设置','存档','工具','AI','关于']) {
              await evaluate('document.querySelector(' + JSON.stringify('.lm_once[aria-label="' + tab + '"]') + ').click()')
              const state = await evaluate('(()=>{const p=document.querySelector(".rightScroll");return {rect:(' + rectCode + ')(document.querySelector(".ui-setup")),overflow:p.scrollWidth-p.clientWidth}})()')
              fits(state.rect, sample, 'settings ' + tab, 8)
              assert.ok(state.overflow <= 1, 'settings horizontal overflow: ' + JSON.stringify({sample,tab,state}))
            }
          } else if (view === 'shop') {
            await evaluate('fixture.closeShop();fixture.setBackground({id:"b0000001",left:86400});fixture.openShop()')
            await pause(20)
            assert.ok(await evaluate('document.querySelector(".backgroundTime").textContent.includes("60天")'), 'background update must be active')
            fits(await evaluate('(' + rectCode + ')(document.querySelector(".ui-shop"))'), sample, 'shop', 8)
            await evaluate('document.querySelector(".rechargeEntry").click()')
            await pause(20)
            fits(await evaluate('(' + rectCode + ')(document.querySelector(".localRecharge"))'), sample, 'recharge', 8)
          } else if (view === 'controls') {
            for (const [x,y] of [[0,0],[sample.width-146,0],[0,sample.height-146],[sample.width-146,sample.height-146],[sample.width/2-73,sample.height/2-73]]) {
              await evaluate('fixture.position(' + x + ',' + y + ')')
              const state = await evaluate('fixture.state()')
              fits(state.row, sample, 'controls', 10)
              const body = state.action
              const overlap = Math.max(0,Math.min(state.row.right,body.right)-Math.max(state.row.x,body.left)) *
                Math.max(0,Math.min(state.row.bottom,body.bottom)-Math.max(state.row.y,body.top))
              assert.ok(overlap < .5, 'controls overlap the animation: ' + JSON.stringify({sample,state:state.row,body}))
            }
          } else {
            for (const side of ['left','right']) {
              await evaluate('fixture.full();fixture.position(0,0);fixture.mini(' + JSON.stringify(side) + ');fixture.cursor({x:innerWidth/2,y:0})')
              const rect = await evaluate('(' + rectCode + ')(document.querySelector(".local-edge-mini"))')
              assert.ok(Math.abs((side === 'left' ? rect.right : sample.width-rect.x)-36)<.2 &&
                rect.y>=7.5 && rect.bottom<=sample.height-7.5, 'mini boundary: ' + JSON.stringify({sample,side,rect}))
            }
          }
          results.push({view,...sample,status:'passed'})
          if (results.length % 100 === 0) console.log('Display matrix checked',results.length)
        } catch (error) {
          writeFileSync('dist/display-matrix-failure.png',(await win.webContents.capturePage()).toPNG())
          writeFileSync('dist/display-matrix-results.json',JSON.stringify({status:'failed',view,sample,error:String(error),completed:results.length,results},null,2))
          throw error
        }
      }
      console.log('Display matrix passed',view,cases.length,'work-area and scale combinations')
    } finally { win.destroy() }
  }
  writeFileSync('dist/display-matrix-results.json',JSON.stringify({
    status:'passed',resolutions,scales,taskbars,
    note:'CSS viewport and DPR emulation. Taskbar strips are simulated work areas; actual desktop toggles are a separate test.',
    combinations:cases.length,viewCases:results.length,results,
  },null,2))
  console.log('Display matrix passed',results.length,'view cases')
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
