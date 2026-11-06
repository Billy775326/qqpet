const { app, BrowserWindow, ipcMain, nativeImage } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')
const { startSave } = require(resolve('dist/ui-popup-native.cjs'))

const profile = mkdtempSync(resolve('dist/progress-profile-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
const disk = startSave(null)
disk.havePet = true
Object.assign(disk.petInfo, {
  growth: 2582, hunger: 1121, clean: 1077, mood: 850, health: 5,
  pinkDiamond: true,
  PDiamondExpirationDate: Date.parse('2026-11-09T06:00:00+08:00') / 1000,
  sweetHeartOverTime: Date.parse('2026-12-04T06:00:00+08:00') / 1000,
})
Object.assign(disk.petComputedlInfo, { level: 6, upGrowth: 1875, nextGrowth: 2875, hungerMax: 1600, cleanMax: 1600 })
ipcMain.handle('fixture:load', () => structuredClone(disk))
ipcMain.on('fixture:save', (event, patch) => {
  for (const [key, value] of Object.entries(patch)) Object.assign(disk[key], value)
  event.returnValue = null
})

app.whenReady().then(async () => {
  const prepared = JSON.parse(readFileSync('dist/ui-sweetheart-prepared.json', 'utf8'))
  const assetRoot = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
  const html = resolve('dist/progress-test.html')
  writeFileSync(html, '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><base href="' + assetRoot + '"><style>' + prepared.css.replaceAll('url(/pet/', 'url(' + assetRoot + 'pet/') + 'body{font-family:sans-serif}</style><body>')
  let win = new BrowserWindow({ width: 800, height: 600, useContentSize: true, show: false, frame: false, transparent: true, hasShadow: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: false, backgroundThrottling: false,
  } })
  const evaluate = expression => win.webContents.executeJavaScript(expression)
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  await win.loadFile(html)
  await resizeViewport(win, 800, 600, 1)
  await evaluate('(async()=>{' + prepared.code + ';fixture.openPetInfo();return true})()')
  await pause(150)

  // Native transparent windows reproduce separate rasterization of cap and center edges.
  // capturePage() defaults to logical pixels; CDP retains the requested device scale.
  const capture = async () => nativeImage.createFromBuffer(Buffer.from((await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  const scales = [1, 1.25, 1.5, 1.75, 2]
  let profileCases = 0
  for (const dpr of [1.25]) {
    await resizeViewport(win, 800, 600, dpr)
    const joins = await evaluate('[...document.querySelectorAll(".ui-petinfo .statBar")].map(bar=>{const r=bar.querySelector(".b_left").getBoundingClientRect();return{right:r.right,top:r.top,bottom:r.bottom}})')
    const shot = await capture(), size = shot.getSize(), pixels = shot.toBitmap(), scale = size.width / 800
    assert.equal(size.width, Math.round(800 * dpr), 'screenshots must retain physical device pixels')
    if (dpr === 1.25) writeFileSync('dist/progress-profile.png', shot.toPNG())
    for (const join of joins) {
      for (let y = Math.ceil((join.top + 3) * scale); y < Math.floor((join.bottom - 3) * scale); y++) {
        for (let x = Math.floor(join.right * scale) - 1; x <= Math.ceil(join.right * scale); x++) {
          const i = (y * size.width + x) * 4, rgb = [...pixels.subarray(i, i + 3)]
          // The original highlights can be almost white; a seam exposes the dark track.
          assert.ok(Math.max(...rgb) > 110, 'profile seam: ' + JSON.stringify({ dpr, join, x, y, rgb }))
        }
      }
    }
    profileCases += joins.length
  }
  // Switching emulated DPR repeatedly in a hidden native transparent window can
  // stall captureScreenshot on Windows. Keep its regression at 125%, then use
  // a fresh offscreen compositor for the full device-scale matrix.
  const nativeWin = win
  win = new BrowserWindow({ width: 800, height: 600, useContentSize: true, show: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false,
  } })
  nativeWin.destroy()
  await win.loadFile(html)
  await evaluate('(async()=>{' + prepared.code + ';return true})()')

  // Pack the size/fill/position matrix into one page per DPR. Native hidden-window
  // screenshots are slow; batching retains coverage without repeated captures.
  await evaluate(`(()=>{
    const host=document.createElement('div');host.id='meters';let index=0;
    for(const height of [14,17]) for(const width of [131.0625,154.9375]) for(const offset of [0,.25,.5,.75]) for(const n of [0,1,20,60,85,100]) {
      const row=document.createElement('div'),column=index%4,line=Math.floor(index/4);
      row.style.cssText='position:absolute;left:'+(40+column*180+offset)+'px;top:'+(20+line*23)+'px;width:'+width+'px;height:'+height+'px';
      row.dataset.n=n;row.append(fixture.progress(n,100,{graded:true}));host.append(row);index++;
    }
    // Text can overlap a short fill's right join; pixel checks isolate the bitmap layer.
    host.querySelectorAll('.seeNum').forEach(e=>e.style.visibility='hidden');
    document.body.append(host);
  })()`)
  let cases = 0
  for (const dpr of scales) {
    await resizeViewport(win, 800, 600, dpr)
    const geometry = await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom}};
      return [...document.querySelectorAll('#meters>div')].map(row=>({n:Number(row.dataset.n),root:rect(row.querySelector('.progress')),fill:rect(row.querySelector('.background_line')),cap:rect(row.querySelector('.b_left')),end:rect(row.querySelector('.b_right')),clip:getComputedStyle(row.querySelector('.background_line')).overflow}));})()`)
    const shot = await capture(), size = shot.getSize(), bitmap = shot.toBitmap(), scale = size.width / 800
    assert.equal(size.width, Math.round(800 * dpr), 'matrix screenshots must retain physical device pixels')
    for (const { n, root, fill, cap, end, clip } of geometry) {
      assert.ok(Math.abs(fill.width - root.width * n / 100) < .03, 'fill retains the actual percentage')
      assert.ok(Math.abs(cap.width - 6) < 1e-4, 'the end cap keeps its native width')
      assert.equal(clip, 'hidden', 'small values clip the caps to the filled portion')
      if (n >= 20) {
        const y = Math.floor((root.top + (root.bottom - root.top) / 2) * scale)
        for (const join of [cap.right, end.left]) for (let x = Math.floor(join * scale) - 1; x <= Math.ceil(join * scale); x++) {
          const i = (y * size.width + x) * 4, rgb = [...bitmap.subarray(i, i + 3)]
          assert.ok(Math.max(...rgb) > 110, 'colored joins must not expose the track: ' + JSON.stringify({ dpr, n, join, x, y, rgb }))
        }
      }
      if (n <= 1) {
        const x = Math.floor((root.left + 8) * scale), y = Math.floor((root.top + (root.bottom - root.top) / 2) * scale)
        const i = (y * size.width + x) * 4
        assert.deepEqual([...bitmap.subarray(i, i + 3)], [63, 63, 63], 'empty track must not gain colored pixels')
      }
      cases++
    }
  }
  const result = { profileSeam: true, nativeTransparentWindow: true, nativeDpr: [1.25], physicalPixels: true, profileCases, dpr: scales, cases }
  writeFileSync('dist/progress-results.json', JSON.stringify(result, null, 2))
  console.log('Stat progress UI verified:', JSON.stringify(result))
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
