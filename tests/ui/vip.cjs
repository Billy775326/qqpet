const { resizeViewport } = require('./viewport.cjs')
const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const DAY = 86400

const profile = mkdtempSync(resolve('dist/vip-profile-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
let disk = {
  settings: { hd: false, paused: false }, activeOption: { work: null, study: null, trip: null, ill: null, die: null },
  petInfo: { name: '隔离宠物', host: '测试主人', birthDay:1700000000,intel:0,strong:0,charm:0,PDgrowth:0,PDiamondLevel:1,PDgrowthValue:0,PDgrowthValue_next:100,PDiamondBeginDate:0,PDiamondExpirationDate:0,pinkDiamond:false, sex: 'GG', growth: 0, hunger: 1000, clean: 1000, mood: 1000, health: 5, yb: 100000, sweetHeart: false, sweetHeartOverTime: 0, onLineTime: 0, onlineDataTime: 0 },
  petComputedlInfo: { level: 1, hungerMax: 1100, cleanMax: 1100, moodMax: 1000, upGrowth: 0, nextGrowth: 100 },
  studyInfo: {}, gameSaveDatas: {travel_china_num:0,ddw:0,yyds:0},
  selfGoodUseOption: { background: null },
}
ipcMain.handle('fixture:load', () => structuredClone(disk))
ipcMain.on('fixture:save', (event, patch) => {
  for (const [key, value] of Object.entries(patch)) Object.assign(disk[key], value)
  event.returnValue = null
})

app.whenReady().then(async () => {
  const prepared = JSON.parse(readFileSync('dist/ui-sweetheart-prepared.json', 'utf8'))
  const assetRoot = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
  const html = resolve('dist/vip-test.html')
  writeFileSync(html, '<!doctype html><html><head><meta charset="UTF-8"><base href="' + assetRoot + '"><style>' + prepared.css.replaceAll('url(/pet/', 'url(' + assetRoot + 'pet/') + '</style></head><body></body></html>')
  const win = new BrowserWindow({ width: 800, height: 600, useContentSize: true, show: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false,
  } })
  const evaluate = code => win.webContents.executeJavaScript(code)
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  await win.loadFile(html)
  await resizeViewport(win, 800, 600)
  await evaluate('(async()=>{' + prepared.code + ';return true})()')
  if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3')
  const cdp = (method, params) => win.webContents.debugger.sendCommand(method, params)
  const click = async selector => {
    const point = await evaluate('(()=>{const e=document.querySelector(' + JSON.stringify(selector) + ');if(!e)throw Error("Missing button");const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()')
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await cdp('Input.dispatchMouseEvent', { type, ...point, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 })
  }
  const count = () => evaluate('Number(document.querySelector(".chooseNum .content").textContent)')
  const buttons = () => evaluate('[...document.querySelectorAll(".quantityButton")].map(e=>e.disabled)')
  const snapshot = () => evaluate('fixture.state()')
  const reset = async (days, balance = 100000, on = true) => {
    await evaluate('fixture.reset(fixture.now()+' + days * DAY + ',' + balance + ',' + on + ')')
  }
  const open = async () => { await evaluate('fixture.open()'); await pause(80) }
  const close = async () => { await click('.windowViewBut'); await pause(30) }

  const resetPink = patch => evaluate('fixture.resetPink(' + JSON.stringify(patch) + ')')
  const pink = () => evaluate('fixture.pinkState()')
  const openPink = async () => { await evaluate('fixture.openPink()'); await pause(80) }
  await resetPink({PDgrowth:0,PDiamondLevel:1,PDiamondExpirationDate:0,PDiamondBeginDate:0,pinkDiamond:false,yb:100000})
  const empty = await pink()
  await openPink()
  assert.match(await evaluate('document.querySelector(".msg").textContent'),/5天粉钻：666元宝/)
  await close()
  assert.deepEqual(await pink(),empty,'cancel does not purchase a pack')
  await openPink()
  await evaluate('window.retainedVipSubmit=document.querySelector(".windowViewButSubmit");true')
  const base = await evaluate('fixture.base()')
  await click('.windowViewButSubmit')
  const first = await pink()
  assert.equal(first.expires,base+5*DAY)
  assert.equal(first.balance,99334)
  assert.equal(first.active,true)
  assert.equal(first.fishResets,empty.fishResets+1)
  await evaluate('window.retainedVipSubmit.click();true')
  assert.deepEqual(await pink(),first,'a retained confirmation cannot purchase twice')
  await openPink()
  assert.match(await evaluate('document.querySelector(".title").textContent'),/粉钻续费/)
  assert.match(await evaluate('document.querySelector(".msg").textContent'),/续费5天粉钻：888元宝/)
  await click('.windowViewButSubmit')
  const extended = await pink()
  assert.equal(extended.expires,first.expires+5*DAY)
  assert.equal(extended.balance,first.balance-888)
  assert.equal(extended.began,first.began,'renewing retains the daily growth accounting baseline')
  assert.equal(extended.fishResets,first.fishResets,'renewing cannot refill fishing speed-ups')
  assert.equal(disk.petInfo.PDiamondExpirationDate,extended.expires)
  assert.equal(disk.petInfo.yb,extended.balance)

  await resetPink({PDgrowth:300,PDiamondLevel:3,PDiamondExpirationDate:0,pinkDiamond:false,yb:100000})
  await openPink()
  assert.match(await evaluate('document.querySelector(".msg").textContent'),/2664元宝/)
  await close()
  await resetPink({PDgrowth:0,PDiamondLevel:1,PDiamondExpirationDate:0,pinkDiamond:false,yb:299})
  await openPink()
  const poor = await pink()
  await click('.windowViewButSubmit')
  assert.match(await evaluate('document.querySelector(".msg").textContent'),/余额不足/)
  assert.deepEqual(await pink(),poor,'insufficient currency cannot open a membership')
  await close()

  await resetPink({PDgrowth:0,PDiamondLevel:1,PDiamondExpirationDate:0,pinkDiamond:false,yb:100000})
  await openPink()
  await resetPink({PDgrowth:100,PDiamondLevel:2})
  const changed = await pink()
  await click('.windowViewButSubmit')
  assert.deepEqual(await pink(),changed,'a changed price is presented before any charge')
  assert.match(await evaluate('document.querySelector(".msg").textContent'),/1776元宝/)
  await click('.windowViewButSubmit')
  assert.equal((await pink()).balance,changed.balance-1776)

  await resetPink({PDgrowth:200,PDiamondLevel:2,PDiamondExpirationDate:await evaluate('fixture.now()-10*86400'),pinkDiamond:true,yb:100000})
  await openPink()
  const stale = await pink()
  const freshBase = await evaluate('fixture.base()')
  await click('.windowViewButSubmit')
  assert.equal((await pink()).expires,freshBase+5*DAY,'an expired flag cannot extend an already expired period')
  assert.equal((await pink()).fishResets,stale.fishResets+1)

  // The original profile badges are real purchase targets, including a new pet without a diamond level.
  await resetPink({PDgrowth:0,PDiamondLevel:0,PDiamondExpirationDate:0,pinkDiamond:false,yb:5000})
  await evaluate('fixture.openPetInfo()')
  await pause(100)
  assert.equal(await evaluate('!!document.querySelector(".ui-petinfo .pinkDiamondMain")'),true)
  await click('.ui-petinfo .pinkDiamondMain')
  await click('.windowViewButSubmit')
  await pause(1150)
  assert.match(await evaluate('document.querySelector(".ui-petinfo .pinkDiamondMain").title'),/点击续费/)
  assert.equal(await evaluate('document.querySelector(".ui-petinfo .yb .smallValue").textContent'),'4334')
  assert.ok(await evaluate('document.querySelector(".ui-petinfo .pinkDiamondUP").classList.contains("pinkDiamondUPs")'))
  await reset(10,4334,true)
  await click('.ui-petinfo .sweetHeart')
  assert.equal(await count(),20,'profile sweetheart uses the shared remaining-time limit')
  await close()
  await evaluate('fixture.openState(100,100)')
  await pause(80)
  await click('.ui-state .pinkDiamond')
  assert.match(await evaluate('document.querySelector(".title").textContent'),/粉钻续费/)
  await close()
  await click('.ui-petinfo .close')
  assert.equal(await evaluate('fixture.timerCount()'),0,'closing service windows releases refresh timers')

  const layouts = []
  for (const [width,height,scale] of [[800,600,1],[320,240,1.25],[426,234,3]]) {
    await resizeViewport(win,width,height,scale)
    await evaluate('fixture.openPetInfo()')
    await pause(100)
    const rects = await evaluate('[...document.querySelectorAll(".ui-petinfo .petInfoMain,.ui-petinfo .pinkDiamondMain,.ui-petinfo .sweetHeart")].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}})')
    for(const r of rects)assert.ok(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height,'profile service entry fits the work area')
    await click('.ui-petinfo .pinkDiamondMain')
    const message = await evaluate('(()=>{const r=document.querySelector(".ui-window .windowView").getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}})()')
    assert.ok(message.x>=0&&message.y>=0&&message.right<=width&&message.bottom<=height)
    await close()
    await click('.ui-petinfo .close')
    layouts.push({width,height,scale})
  }
  await resizeViewport(win,800,600)
  await evaluate('fixture.openPetInfo()')
  await pause(100)
  writeFileSync('dist/vip-profile.png',(await win.webContents.capturePage()).toPNG())
  await click('.ui-petinfo .pinkDiamondMain')
  writeFileSync('dist/vip-renewal.png',(await win.webContents.capturePage()).toPNG())
  await close()
  await click('.ui-petinfo .close')
  const report={firstPack:true,renewal:true,levelPricing:true,insufficientFunds:true,stalePrice:true,expiredBooking:true,profileEntries:true,liveProfile:true,timerCleanup:true,layouts}
  writeFileSync('dist/vip-results.json',JSON.stringify(report,null,2))
  console.log('VIP services passed:',JSON.stringify(report))
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
