const { app, BrowserWindow, ipcMain } = require('electron')
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
  const win = new BrowserWindow({ width: 800, height: 600, useContentSize: true, show: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false,
  } })
  const evaluate = expression => win.webContents.executeJavaScript(expression)
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  await win.loadFile(html)
  await resizeViewport(win, 800, 600, 1)
  await evaluate('(async()=>{' + prepared.code + ';fixture.openPetInfo();return true})()')
  await pause(150)

  // The expiry labels reproduce the unequal column widths that exposed the seam.
  const mood = await evaluate(`(()=>{
    const bar=document.querySelectorAll('.ui-petinfo .statBar')[4],left=bar.querySelector('.b_left').getBoundingClientRect();
    return {join:left.right,top:left.top};
  })()`)
  const pixels = (await win.webContents.capturePage()).toBitmap()
  const pixel = (x, y) => [...pixels.subarray((y * 800 + x) * 4, (y * 800 + x) * 4 + 3)]
  for (let x = Math.floor(mood.join) - 1; x <= Math.ceil(mood.join); x++) {
    const rgb = pixel(x, Math.floor(mood.top + 7))
    assert.ok(Math.max(...rgb) - Math.min(...rgb) > 40, 'the mood cap join must not expose the gray track: ' + JSON.stringify({ x, rgb }))
  }
  writeFileSync('dist/progress-profile.png', (await win.webContents.capturePage()).toPNG())
  await evaluate(`document.querySelector('.ui-petinfo').closest('.boxFrame').remove()`)

  let cases = 0
  for (const dpr of [1, 1.25, 1.5, 1.75, 2]) {
    await resizeViewport(win, 800, 600, dpr)
    for (const height of [14, 17]) for (const width of [131.0625, 154.9375]) {
      await evaluate(`(()=>{
        document.querySelector('#meters')?.remove();const host=document.createElement('div');host.id='meters';
        host.style.cssText='position:absolute;left:40.0625px;top:40px;width:${width}px';
        for(const n of [0,1,20,60,85,100]) {const row=document.createElement('div');row.style.cssText='height:${height}px;margin-bottom:5px';row.dataset.n=n;row.append(fixture.progress(n,100,{graded:true}));host.append(row)}
        document.body.append(host);
      })()`)
      await pause(80)
      const geometry = await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom}};
        return [...document.querySelectorAll('#meters>div')].map(row=>({n:Number(row.dataset.n),root:rect(row.querySelector('.progress')),fill:rect(row.querySelector('.background_line')),cap:rect(row.querySelector('.b_left')),clip:getComputedStyle(row.querySelector('.background_line')).overflow}));})()`)
      const shot = await win.webContents.capturePage(), size = shot.getSize(), bitmap = shot.toBitmap(), scale = size.width / 800
      for (const { n, root, fill, cap, clip } of geometry) {
        assert.ok(Math.abs(fill.width - root.width * n / 100) < .03, 'fill retains the actual percentage')
        assert.equal(cap.width, 6, 'the end cap keeps its native width')
        assert.equal(clip, 'hidden', 'small values clip the caps to the filled portion')
        if (n === 85) {
          const y = Math.floor((root.top + height / 2) * scale)
          for (let x = Math.floor(cap.right * scale) - 1; x <= Math.ceil(cap.right * scale); x++) {
            const offset = (y * size.width + x) * 4, rgb = [...bitmap.subarray(offset, offset + 3)]
            assert.ok(Math.max(...rgb) - Math.min(...rgb) > 40, 'scaled blue bars must not expose the gray track at the join')
          }
        }
        // A zero/low fill must leave the track beyond the actual value untouched.
        if (n <= 1) {
          const x = Math.floor((root.left + 8) * scale), y = Math.floor((root.top + height / 2) * scale)
          const offset = (y * size.width + x) * 4
          assert.deepEqual([...bitmap.subarray(offset, offset + 3)], [63, 63, 63], 'empty track must not gain colored pixels')
        }
        cases++
      }
    }
  }
  const result = { profileSeam: true, dpr: [1, 1.25, 1.5, 1.75, 2], cases }
  writeFileSync('dist/progress-results.json', JSON.stringify(result, null, 2))
  console.log('Stat progress UI verified:', JSON.stringify(result))
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
