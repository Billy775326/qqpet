const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')
const { startSave } = require(resolve('dist/ui-popup-native.cjs'))
const profile = mkdtempSync(resolve('dist/shop-membership-profile-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
const disk = startSave(null)
disk.havePet = true
const now = Date.parse('2026-11-06T10:00:00+08:00')
ipcMain.handle('fixture:load', () => structuredClone(disk))
ipcMain.on('fixture:save', (event, patch) => {
  for (const [key, value] of Object.entries(patch)) Object.assign(disk[key], value)
  event.returnValue = null
})
app.whenReady().then(async () => {
  const prepared = JSON.parse(readFileSync('dist/ui-shop-prepared.json', 'utf8'))
  const assetRoot = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
  const html = resolve('dist/shop-membership-test.html')
  writeFileSync(html, '<!doctype html><meta charset="UTF-8"><base href="' + assetRoot + '"><style>' + prepared.css.replaceAll('url(/pet/', 'url(' + assetRoot + 'pet/') + '</style><body>')
  const win = new BrowserWindow({ width: 1000, height: 720, useContentSize: true, show: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false,
  } })
  const evaluate = expression => win.webContents.executeJavaScript(expression)
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  await win.loadFile(html)
  await resizeViewport(win, 1000, 720, 1)
  await evaluate('(async()=>{' + prepared.code + ';fixture.clock(' + now + ');fixture.openShop();return true})()')
  const values = () => evaluate('[...document.querySelectorAll(".membershipTime")].map(e=>e.textContent)')
  const move = async (x, y) => { await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await pause(40) }
  const hover = async selector => {
    const p = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await move(p.x, p.y)
  }
  const shown = () => evaluate('[...document.querySelectorAll(".membershipHint")].filter(e=>getComputedStyle(e).display!=="none").length')
  assert.deepEqual(await values(), ['未开通', '未开通'])
  const expiry = now / 1000 + 2 * 86400 + 3 * 3600 + 4 * 60 + 5
  await evaluate(`fixture.setMembership({PDiamondExpirationDate:${expiry},sweetHeartOverTime:${expiry},sweetHeart:false});true`)
  assert.deepEqual(await values(), ['2天 03小时04分05秒', '2天 03小时04分05秒'])
  assert.match(await evaluate('document.querySelectorAll(".membershipHint")[1].textContent'), /托管已关闭/)
  assert.match(await evaluate('document.querySelector(".membershipExpiry").textContent'), /到期时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
  assert.equal(await evaluate('document.querySelectorAll(".shopMembership [title]").length'), 0, 'native tooltips are removed')
  assert.equal(await shown(), 0)
  for (const part of ['.membershipIcon', '.membershipLabel', '.membershipDays', '.membershipClock']) {
    await hover('.membershipRow:first-child ' + part)
    assert.equal(await shown(), 1, 'actual service content triggers the themed hint')
  }
  await evaluate('fixture.advance(1);true')
  await pause(1100)
  assert.deepEqual(await values(), ['2天 03小时04分04秒', '2天 03小时04分04秒'])
  assert.equal(await shown(), 1, 'a stationary hover survives countdown updates')
  await hover('.membershipRow:nth-child(2) .membershipLabel')
  assert.equal(await shown(), 1, 'moving between services does not leave the first tooltip open')
  for (const region of ['row-end', 'label-gap', 'separator', 'pet']) {
    const p = await evaluate(`(()=>{
      const row=document.querySelector('.membershipRow'),r=row.getBoundingClientRect(),label=row.querySelector('.membershipLabel').getBoundingClientRect(),time=row.querySelector('.membershipTime').getBoundingClientRect(),group=document.querySelector('.shopMembership').getBoundingClientRect(),pet=document.querySelector('.petImgBox').getBoundingClientRect();
      return ${JSON.stringify(region)}==='row-end'?{x:r.right-2,y:r.y+r.height/2}:${JSON.stringify(region)}==='label-gap'?{x:(label.right+time.left)/2,y:r.y+r.height/2}:${JSON.stringify(region)}==='separator'?{x:group.x+group.width/2,y:group.top+2}:{x:pet.x+pet.width/2,y:pet.y+pet.height/2};
    })()`)
    await move(p.x, p.y)
    assert.equal(await shown(), 0, region + ' is outside the tooltip hit region')
  }
  await evaluate('fixture.setBalance(5010);true')
  assert.equal(await evaluate('document.querySelectorAll(".shopMembership").length'), 1, 'inventory redraw moves the existing countdown without duplication')
  assert.equal(await evaluate('fixture.timerCount()'), 1)
  await evaluate(`fixture.setMembership({PDiamondExpirationDate:${expiry + 86400},sweetHeartOverTime:${expiry + 3600},sweetHeart:true});true`)
  assert.deepEqual(await values(), ['3天 03小时04分04秒', '2天 04小时04分04秒'])
  await evaluate('fixture.setMembership({PDiamondExpirationDate:1,sweetHeartOverTime:1});true')
  assert.deepEqual(await values(), ['已到期', '已到期'])
  await evaluate(`fixture.setMembership({PDiamondExpirationDate:${expiry},sweetHeartOverTime:${expiry}});fixture.setBackground({id:'b0000001',left:86400});fixture.closeShop();fixture.openShop();true`)
  let cases = 0
  for (const [width, height, dpr] of [[1000,720,1],[800,600,1.25],[640,480,1.5],[360,640,2]]) {
    await resizeViewport(win, width, height, dpr)
    const geometry = await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return{panel:rect(document.querySelector('.leftSelfHeadBk')),pet:rect(document.querySelector('.petImgBox')),background:rect(document.querySelector('.backgroundImg')),hint:rect(document.querySelector('.backgroundTime')),rows:[...document.querySelectorAll('.membershipRow')].map(e=>({...rect(e),overflow:e.scrollWidth>e.clientWidth+1})),images:[...document.querySelectorAll('.membershipIcon')].every(i=>i.complete&&i.naturalWidth>0)}})()`)
    for (const r of geometry.rows) {
      assert.ok(r.left >= geometry.panel.left && r.right <= geometry.panel.right + 1 && r.bottom < geometry.panel.bottom)
      assert.ok(r.top > geometry.pet.bottom && r.top > geometry.background.bottom && r.top > geometry.hint.bottom, 'the timers avoid the pet, background artwork and its hover label')
      assert.equal(r.overflow, false)
    }
    assert.equal(geometry.images, true)
    await hover('.membershipRow:first-child .membershipLabel')
    const hint = await evaluate(`(()=>{const e=document.querySelector('.membershipHint'),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,color:s.backgroundColor,pointer:s.pointerEvents}})()`)
    assert.ok(hint.left >= 0 && hint.right <= width && hint.top >= 0 && hint.bottom <= height, 'the hint stays visible at each tested scale')
    assert.equal(hint.pointer, 'none', 'the hint cannot intercept other shop controls')
    assert.equal(hint.color, await evaluate('getComputedStyle(document.querySelector(".selfGoodImgBox .goodFloatMsg")).backgroundColor'), 'reuse the original shop item tooltip skin')
    await move(0, 0)
    cases++
  }
  await resizeViewport(win, 1000, 720, 1)
  await evaluate('fixture.setBackground(null);fixture.closeShop();fixture.openShop();true')
  writeFileSync('dist/shop-membership.png', (await win.webContents.capturePage()).toPNG())
  await hover('.membershipRow:nth-child(2) .membershipLabel')
  writeFileSync('dist/shop-membership-tooltip.png', (await win.webContents.capturePage()).toPNG())
  await evaluate('fixture.closeShop();true')
  assert.equal(await evaluate('fixture.timerCount()'), 0)
  assert.equal(await evaluate('document.querySelectorAll(".membershipHint").length'), 0)
  for (let i = 0; i < 3; i++) {
    await evaluate('fixture.openShop();fixture.openShop();true')
    assert.equal(await evaluate('fixture.timerCount()'), 1)
    await evaluate('fixture.closeShop();true')
    assert.equal(await evaluate('fixture.timerCount()'), 0)
  }
  writeFileSync('dist/shop-membership-results.json', JSON.stringify({ cases, countdownSeconds: true, renewal: true, expiry: true, disabledCareRetainsTime: true, timerCleanup: true }, null, 2))
  console.log('Shop membership countdown verified: exact seconds, renewal, expiry, 4 viewport/scales and timer cleanup')
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
