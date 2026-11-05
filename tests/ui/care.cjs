const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')
const { startSave } = require(resolve('dist/ui-popup-native.cjs'))
const profile = mkdtempSync(resolve('dist/care-profile-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
const disk = startSave(null)
disk.havePet = true
let failSave = false
ipcMain.handle('fixture:load', () => structuredClone(disk))
ipcMain.on('fixture:save', (event, patch) => {
  if (failSave) { event.returnValue = 'Simulated write failure'; return }
  for (const [key, value] of Object.entries(patch)) Object.assign(disk[key], value)
  event.returnValue = null
})
app.whenReady().then(async () => {
  const prepared = JSON.parse(readFileSync('dist/ui-sweetheart-prepared.json', 'utf8'))
  const assetRoot = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
  const html = resolve('dist/care-test.html')
  writeFileSync(html, '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><base href="' + assetRoot + '"><style>' + prepared.css.replaceAll('url(/pet/', 'url(' + assetRoot + 'pet/') + '</style><body>')
  const win = new BrowserWindow({ width: 800, height: 600, useContentSize: true, show: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false,
  } })
  const evaluate = expression => win.webContents.executeJavaScript(expression)
  win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) console.error('Care fixture:', event.message) })
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  await win.loadFile(html)
  await resizeViewport(win, 800, 600)
  await evaluate('(async()=>{' + prepared.code + ';fixture.open();return true})()')
  await pause(100)
  const click = async selector => {
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    for (const type of ['mousePressed', 'mouseReleased']) await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 })
    await pause(40)
  }
  const state = () => evaluate('fixture.careState()')
  const draft = async (percent, food, buy) => evaluate(`(()=>{
    const root=document.querySelector('.sweetHeartCareSettings'),range=root.querySelector('input[type=range]'),select=root.querySelector('select'),toggle=root.querySelector('input[type=checkbox]');
    range.value=${percent};range.dispatchEvent(new Event('input'));select.value=${JSON.stringify(food)};select.dispatchEvent(new Event('change'));toggle.checked=${buy};toggle.dispatchEvent(new Event('change'));return true;
  })()`)
  const setDaily = async enabled => {
    await click('.careTab[data-type=daily]')
    await evaluate(`(()=>{const e=document.querySelector('[data-setting=careAutoDaily]');e.checked=${enabled};e.dispatchEvent(new Event('change'));return true})()`)
  }
  const original = await state(), balance = disk.petInfo.yb
  await evaluate('document.querySelector(".sweetHeartCareEntry").style.visibility="hidden";true')
  writeFileSync('dist/care-original-artwork.png', (await win.webContents.capturePage()).toPNG())
  await evaluate('document.querySelector(".sweetHeartCareEntry").style.visibility="";true')
  writeFileSync('dist/care-entry.png', (await win.webContents.capturePage()).toPNG())
  await click('.sweetHeartCareEntry')
  assert.equal(await evaluate('document.querySelectorAll(".sweetHeartCareSettings").length'), 1, 'the text hotspot opens settings')
  assert.equal(await evaluate('document.querySelector("input[type=range]").value'), '60')
  assert.equal(await evaluate('document.querySelector("input[type=checkbox]").checked'), false)
  assert.equal(await evaluate(`document.querySelector('select option[value="102010002"]').disabled`), true, 'locked food is not selectable')
  assert.equal(await evaluate(`document.querySelector('select option[value="10013006"]').disabled`), false, 'owned food remains usable even when not sold')
  await click('.careTab[data-type=daily]')
  assert.equal(await evaluate('document.querySelector("[data-setting=careAutoDaily]").checked'), false)
  assert.equal(await evaluate('document.querySelector("[data-setting=careAutoBuy]").getClientRects().length'), 0, 'the task tab has no purchase control')
  assert.match(await evaluate('document.querySelector(".careDetails").textContent'), /小游戏与升学考试仍需手动/)
  await click('.careTab[data-type=food]')
  await draft(75, '102010003', true)
  await click('.careTab[data-type=clean]')
  await draft(65, '102020003', true)
  await click('.careTab[data-type=toy]')
  await draft(70, 't0002', true)
  await setDaily(true)
  await click('.careCancel')
  assert.deepEqual(await state(), original)
  await click('.sweetHeartCareEntry')
  await draft(75, '102010003', true)
  await click('.careTab[data-type=clean]')
  await draft(65, '102020003', true)
  await click('.careTab[data-type=toy]')
  await draft(70, 't0002', true)
  await setDaily(true)
  await click('.careSave')
  assert.equal(disk.settings.careHungerPercent, 75)
  assert.equal(disk.settings.careFoodId, '102010003')
  assert.equal(disk.settings.careAutoBuy, true)
  assert.equal(disk.settings.careCleanPercent, 65)
  assert.equal(disk.settings.careCleanId, '102020003')
  assert.equal(disk.settings.careMoodPercent, 70)
  assert.equal(disk.settings.careToyId, 't0002')
  assert.equal(disk.settings.careAutoDaily, true)
  const saved = await state()
  assert.equal(disk.petInfo.yb, balance, 'editing policy never buys items')
  await click('.sweetHeartCareEntry')
  await draft(90, '', false)
  await setDaily(false)
  await click('.careTab[data-type=clean]')
  await draft(90, '', false)
  failSave = true
  await click('.careSave')
  failSave = false
  assert.match(await evaluate('document.querySelector(".careError").textContent'), /保存失败/)
  assert.deepEqual(await state(), saved, 'failed save restores every category of the active policy')
  await click('.careCancel')
  for (let i = 0; i < 3; i++) {
    await click('.sweetHeartCareEntry')
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));true')
    assert.equal(await evaluate('document.querySelectorAll(".sweetHeartCareSettings").length'), 0)
    assert.equal(await evaluate('fixture.timerCount()'), 1, 'only the purchase dialog refresh remains')
  }
  await win.loadFile(html)
  await evaluate('(async()=>{' + prepared.code + ';fixture.open();return true})()')
  await pause(100)
  await click('.sweetHeartCareEntry')
  assert.equal(await evaluate('document.querySelector("input[type=range]").value'), '75', 'reloading reads the saved threshold')
  assert.equal(await evaluate('document.querySelector("select").value'), '102010003')
  assert.equal(await evaluate('document.querySelector("input[type=checkbox]").checked'), true)
  for (const [type, percent, item] of [['clean', '65', '102020003'], ['toy', '70', 't0002']]) {
    await click('.careTab[data-type=' + type + ']')
    assert.equal(await evaluate('document.querySelector("input[type=range]").value'), percent)
    assert.equal(await evaluate('document.querySelector("select").value'), item)
    writeFileSync('dist/care-' + type + '.png', (await win.webContents.capturePage()).toPNG())
  }
  await click('.careTab[data-type=daily]')
  assert.equal(await evaluate('document.querySelector("[data-setting=careAutoDaily]").checked'), true, 'the automatic daily preference survives a reload')
  const layouts = []
  for (const [width, height, scale] of [[800,600,1],[320,480,1.25],[320,240,2]]) {
    await resizeViewport(win, width, height, scale)
    for (const type of ['food', 'clean', 'toy', 'daily']) {
      await click('.careTab[data-type=' + type + ']')
      assert.equal(await evaluate('document.querySelector("[data-setting=careAutoBuy]").getClientRects().length>0'), type !== 'daily', 'restocking is shown only on supply tabs')
      const selectors = ['.sweetHeartCareSettings', '.careTabs', '.careDetails', '.careActions', ...(type === 'daily' ? ['[data-setting=careAutoDaily]'] : ['.careRange', '.sweetHeartCareSettings select'])]
      const boxes = await evaluate(JSON.stringify(selectors) + '.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,clipped:e.scrollWidth>e.clientWidth+1}})')
      for (const b of boxes) {
        assert.ok(b.x >= 0 && b.y >= 0 && b.right <= width + .1 && b.bottom <= height + .1, JSON.stringify(b))
        assert.equal(b.clipped, false)
      }
      layouts.push({ width, height, scale, type })
    }
  }
  await resizeViewport(win, 800, 600)
  writeFileSync('dist/care-settings.png', (await win.webContents.capturePage()).toPNG())
  await click('.careClose')
  await click('.windowViewBut')
  assert.equal(await evaluate('fixture.timerCount()'), 0)
  const report = { hotspot: true, saveCancel: true, persistence: true, failedSave: true, cleanup: true, layouts }
  writeFileSync('dist/care-results.json', JSON.stringify(report, null, 2))
  console.log('Sweetheart care settings verified:', JSON.stringify(report))
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
