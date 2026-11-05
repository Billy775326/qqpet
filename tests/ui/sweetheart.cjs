const { resizeViewport } = require('./viewport.cjs')
const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const DAY = 86400

const profile = mkdtempSync(resolve('dist/sweetheart-profile-'))
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
  const html = resolve('dist/sweetheart-test.html')
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

  await reset(10)
  const original = await snapshot()
  await evaluate('fixture.openState(100,100)')
  await pause(60)
  await click('.ui-state .sweetHeart')
  assert.equal(await count(), 20, 'remaining ten days leaves twenty purchasable days')
  assert.equal(await evaluate('document.querySelector(".sweetHeartRemaining").textContent'), '剩余约10天')
  assert.equal(await evaluate('document.querySelector(".sweetHeartAvailable").textContent'), '最多可续20天')
  assert.equal(await evaluate('document.querySelector(".sweetHeartPrice").textContent'), '托管费用：300 元宝 / 天')
  assert.deepEqual(await buttons(), [false, false, true, true])
  await click('.cutUpOver')
  assert.equal(await count(), 10)
  assert.deepEqual(await buttons(), [false, false, false, false])
  await click('.addUpOver')
  assert.equal(await count(), 20)
  await click('.windowViewButSubmit')
  assert.deepEqual(await snapshot(), { expires: original.expires + 20 * DAY, balance: 94000, on: true })
  assert.equal(disk.petInfo.sweetHeartOverTime, original.expires + 20 * DAY, 'actual renewal persists the capped expiry')
  assert.equal(disk.petInfo.yb, 94000, 'only selected renewal days are charged')

  // Existing on/off action remains independent of expiry and never charges.
  await evaluate('fixture.openState(100,100)')
  await pause(60)
  await click('.closeSweetHeart')
  assert.equal(await evaluate('document.querySelectorAll(".chooseNum").length'), 0)
  await click('.windowViewButSubmit')
  assert.deepEqual(await snapshot(), { expires: original.expires + 20 * DAY, balance: 94000, on: false })
  await evaluate('fixture.openState(100,100)')
  await pause(60)
  await click('.openSweetHeart')
  await click('.windowViewButSubmit')
  assert.equal((await snapshot()).on, true)

  await open()
  assert.equal(await count(), 0)
  assert.deepEqual(await buttons(), [true, true, true, true])
  assert.equal(await evaluate('document.querySelector(".windowViewButSubmit").getAttribute("aria-disabled")'), 'true')
  const full = await snapshot()
  await evaluate('document.querySelector(".windowViewButSubmit").click();true')
  assert.deepEqual(await snapshot(), full, 'full remaining time never deducts currency')
  writeFileSync('dist/sweetheart-full.png', (await win.webContents.capturePage()).toPNG())
  await close()

  // Revalidate immediately before paying, without waiting for the periodic UI refresh.
  await reset(10)
  await open()
  await reset(25)
  const changed = await snapshot()
  await click('.windowViewButSubmit')
  assert.equal(await count(), 5)
  assert.deepEqual(await snapshot(), changed, 'stale purchase selection is refreshed before any deduction')
  await click('.windowViewButSubmit')
  assert.equal((await snapshot()).expires, changed.expires + 5 * DAY)
  assert.equal((await snapshot()).balance, changed.balance - 1500)

  await reset(30)
  await open()
  assert.equal(await count(), 0)
  await evaluate('fixture.advance(86400)')
  await pause(1150)
  assert.equal(await count(), 1, 'an elapsed day opens one day of capacity while the dialog remains open')
  assert.equal(await evaluate('document.querySelector(".windowViewButSubmit").getAttribute("aria-disabled")'), 'false')
  await click('.windowViewButSubmit')
  assert.equal((await snapshot()).balance, 99700)
  assert.equal(await evaluate('fixture.capacity().remainingDays'), 30)

  await reset(10.5)
  await open()
  assert.equal(await count(), 19, 'fractional remaining days cannot exceed thirty days after a whole-day renewal')
  await close()
  await reset(60)
  await open()
  const legacy = await snapshot()
  assert.equal(await count(), 0)
  await evaluate('document.querySelector(".windowViewButSubmit").click();true')
  assert.deepEqual(await snapshot(), legacy, 'legacy over-cap bookings are preserved')
  await close()

  await reset(10)
  const guarded = await snapshot()
  for (const days of [21, 31, 0, -1, 1.5]) {
    assert.equal(await evaluate('(()=>{try{fixture.addSweetHeart(' + days + ');return false}catch(e){return e instanceof RangeError}})()'), true)
    assert.deepEqual(await snapshot(), guarded, 'the booking function rejects invalid periods before mutation')
  }
  await reset(10, 299, false)
  await open()
  const poor = await snapshot()
  await click('.windowViewButSubmit')
  assert.match(await evaluate('document.querySelector(".msg").textContent'), /余额不足/)
  assert.deepEqual(await snapshot(), poor, 'insufficient funds cannot extend or enable the service')
  await close()

  await reset(-1, 100000, false)
  await evaluate('fixture.openState(100,100)')
  await pause(60)
  await click('.openSweetHeart')
  assert.equal(await count(), 30, 'expired timestamp opens purchasing instead of toggling an invalid booking')
  const base = await evaluate('fixture.base()')
  await click('.windowViewButSubmit')
  assert.equal((await snapshot()).expires, base + 30 * DAY)
  assert.equal((await snapshot()).balance, 91000)

  await reset(10)
  for (let i=0;i<5;i++) {
    await open()
    assert.equal(await evaluate('document.querySelectorAll(".ui-window").length'),1)
    assert.equal(await evaluate('fixture.timerCount()'),1,'repeated opening keeps only the current live refresh timer')
  }
  await close()
  assert.equal(await evaluate('fixture.timerCount()'),0,'closing releases the live refresh timer')

  const layouts = []
  for (const [width, height, scale] of [[800,600,1],[320,240,1.25],[426,234,3]]) {
    await resizeViewport(win,width,height,scale)
    for (const days of [0, 10, 30, 60]) {
      await reset(days)
      await open()
      const boxes = await evaluate('[".sweetHeart",".sweetHeartPeriod",".sweetHeartPrice",".chooseNum",".windowViewButSubmit"].map(s=>{const r=document.querySelector(".ui-window "+s).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}})')
      const [skin, period, price, quantity, submit] = boxes
      for (const b of boxes) assert.ok(b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= height)
      // The baked-in explanation and its border occupy the first 294px of the 405px skin.
      assert.ok(period.y >= skin.y + skin.height * 294 / 405, 'remaining time stays below the original artwork lettering')
      assert.ok(period.bottom <= price.y + 0.5, 'remaining time and daily price occupy separate lines')
      assert.ok(price.bottom <= quantity.y + 0.5, 'price does not cover quantity controls')
      assert.ok(quantity.bottom <= submit.y + 0.5, 'quantity controls do not cover confirmation')
      assert.equal(await evaluate('document.querySelector(".sweetHeartSummary").scrollWidth <= document.querySelector(".sweetHeartSummary").clientWidth'), true, 'summary text fits without horizontal clipping')
      layouts.push({width,height,scale,days})
      await close()
    }
  }
  await resizeViewport(win,800,600)
  await reset(10)
  await open()
  writeFileSync('dist/sweetheart-renewal.png',(await win.webContents.capturePage()).toPNG())
  await close()
  const report = { remainingCap: true, persistedPayment: true, togglePreserved: true, staleSelectionGuard: true, liveTimeRefresh: true, fractionalDays: true, expiredAndLegacy: true, insufficientFunds: true, timerCleanup: true, layouts }
  writeFileSync('dist/sweetheart-results.json',JSON.stringify(report,null,2))
  console.log('Sweetheart renewal passed:',JSON.stringify(report))
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
