const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')
const { startSave } = require(resolve('dist/ui-popup-native.cjs'))
const profile = mkdtempSync(resolve('dist/tasks-profile-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
const disk = startSave(null)
disk.havePet = true
disk.petComputedlInfo.level = 6
disk.studyInfo.chinese = 9
disk.studyInfo.mathematics = 10
const day = new Date()
day.setHours(6, 0, 0, 0)
if (day.getTime() > Date.now()) day.setDate(day.getDate() - 1)
disk.saveJsonData.task = JSON.stringify({
  dailyDay: day.getTime() / 1000,
  doNums: { Amusing: 10, Study: 3, Work: 1, Eat: 1 },
  daily: [{ label: '喂我吃东西2次', msg: '吃饱饱才能长高高~', obj: 'Eat', num: 2 }],
  taskList: { daily: [{ take: false, good: [{ id: 'yb', type: 'nums', name: '元宝', url: 'pet/img_res/muns/l1.gif', num: 20 }] }] },
})
disk.gameSaveDatas.travel_china = Array.from({ length: 5 }, (_, i) => ({ name: String(i), value: 1 }))
ipcMain.handle('fixture:load', () => structuredClone(disk))
ipcMain.on('fixture:save', (event, patch) => {
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) disk[key] = value
    else Object.assign(disk[key], value)
  }
  event.returnValue = null
})

app.whenReady().then(async () => {
  const prepared = JSON.parse(readFileSync('dist/ui-tasks-prepared.json', 'utf8'))
  const assetRoot = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
  const html = resolve('dist/tasks-test.html')
  writeFileSync(html, '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><base href="' + assetRoot + '"><style>' + prepared.css.replaceAll('url(/pet/', 'url(' + assetRoot + 'pet/') + '</style><body>')
  const win = new BrowserWindow({ width: 800, height: 600, useContentSize: true, show: false, webPreferences: {
    preload: join(__dirname, 'shop-preload.cjs'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false,
  } })
  const evaluate = expression => win.webContents.executeJavaScript(expression)
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  await win.loadFile(html)
  await resizeViewport(win, 800, 600, 1)
  await evaluate('(async()=>{' + prepared.code + ';fixture.open();return true})()')
  await pause(100)
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'});true`)
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    for (const type of ['mousePressed', 'mouseReleased']) await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 })
    await pause(40)
  }
  assert.equal(await evaluate('document.querySelectorAll(".t_tab").length'), 3)
  assert.equal(await evaluate('document.querySelectorAll(".taskOnce").length'), 12)
  assert.equal(await evaluate('document.querySelectorAll(".taskOnce[data-task-id=travel-2]").length'), 0)
  const first = await evaluate('document.querySelector(".taskOnce").className')
  assert.match(first, /ready/, 'ready rewards come first')
  await click('[data-filter=growth]')
  assert.equal(await evaluate('document.querySelectorAll(".taskOnce").length'), 4)
  await click('[data-task-id=growth-1] .taskClaim')
  let progress = JSON.parse(disk.saveJsonData.task)
  assert.equal(progress.taskList.growth[1].take, true)
  assert.equal(progress.taskList.growth[0].take, false, 'sorting never changes the claimed source index')
  await click('.getResult .but_small')
  await click('[data-group=once]')
  assert.equal(await evaluate('document.querySelectorAll(".taskOnce").length'), 26)
  assert.equal(await evaluate('document.querySelector("[data-task-id=first-diploma] .taskProgress").textContent'), '1/1')
  await click('[data-task-id=first-meal] .taskClaim')
  await evaluate('fixture.addCount("Amusing");true')
  await pause(1100)
  assert.equal(await evaluate('document.querySelectorAll(".getResult").length'), 1, 'live progress cannot dismiss reward confirmation')
  await click('.getResult .but_small')
  const food = [...disk.selfGoodDatas.food]
  await click('[data-task-id=first-meal] .taskClaim')
  assert.deepEqual(disk.selfGoodDatas.food, food, 'repeated claim grants no second reward')
  assert.ok(food.includes('_102010001*5'), 'two reward items add to the three starter items')
  await click('[data-task-id=level-20] .taskClaim')
  assert.equal(JSON.parse(disk.saveJsonData.task).milestones.claimed.includes('level-20'), false)
  await evaluate('document.querySelector(".tasks").scrollTop=90;fixture.addCount("Clean");true')
  await pause(1100)
  assert.equal(await evaluate('document.querySelector("[data-task-id=first-bath] .taskProgress").textContent'), '1/1')
  assert.equal(await evaluate('document.querySelector(".tasks").scrollTop'), 90, 'live progress retains scroll position')
  await click('[data-group=travel]')
  assert.equal(await evaluate('document.querySelectorAll(".taskOnce").length'), 7)
  await click('[data-task-id=travel-2] .taskClaim')
  await click('.getResult .but_small')
  await evaluate('fixture.resetTasks();true')
  assert.equal(JSON.parse(disk.saveJsonData.task).taskList.travel[2].take, true)
  assert.ok(JSON.parse(disk.saveJsonData.task).milestones.claimed.includes('first-meal'))
  await pause(1100)
  let cases = 0
  for (const [width, height, dpr] of [[800,600,1], [1024,768,1.25], [640,480,1.5], [360,640,2]]) {
    await resizeViewport(win, width, height, dpr)
    for (const group of ['daily', 'once', 'travel']) {
      await click('[data-group=' + group + ']')
      const geometry = await evaluate(`(()=>{const list=document.querySelector('.tasks'),r=document.querySelector('.box').getBoundingClientRect();return {overflow:list.scrollWidth-list.clientWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom,images:[...document.querySelectorAll('.goodImg')].every(i=>i.complete&&i.naturalWidth>0)}})()`)
      assert.ok(geometry.overflow <= 1, JSON.stringify({ width, group, geometry }))
      assert.ok(geometry.left >= -1 && geometry.right <= width + 1 && geometry.top >= -1 && geometry.bottom <= height + 1)
      assert.equal(geometry.images, true, 'reward images load from actual resources')
      cases++
    }
  }
  await resizeViewport(win, 800, 600, 1)
  await click('[data-group=once]')
  await evaluate('document.querySelector(".tasks").scrollTop=0;true')
  writeFileSync('dist/tasks-once.png', (await win.webContents.capturePage()).toPNG())
  await click('[data-group=daily]')
  await click('[data-filter=all]')
  await evaluate('document.querySelector(".tasks").scrollTop=0;true')
  writeFileSync('dist/tasks-daily.png', (await win.webContents.capturePage()).toPNG())
  await click('.box>.head>.close')
  assert.equal(await evaluate('fixture.timerCount()'), 0)
  for (let i = 0; i < 3; i++) {
    await evaluate('fixture.open();fixture.open();true')
    assert.equal(await evaluate('fixture.timerCount()'), 1)
    await click('.box>.head>.close')
    assert.equal(await evaluate('fixture.timerCount()'), 0)
  }
  await win.loadFile(html)
  await evaluate('(async()=>{' + prepared.code + ';fixture.open();return true})()')
  await click('[data-group=once]')
  assert.match(await evaluate('document.querySelector("[data-task-id=first-meal] .taskClaim").textContent'), /已领取/)
  writeFileSync('dist/tasks-results.json', JSON.stringify({ cases, permanentGoals: 26, repeatedClaim: true, reload: true, timerCleanup: true }, null, 2))
  console.log('Task UI verified: 12 viewport/group combinations; legacy source indices, permanent claims, reload and timer cleanup')
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
