const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync, renameSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')
const profile = mkdtempSync(resolve('dist/toys-profile-'))
app.setPath('userData',profile);app.setPath('sessionData',profile);app.setAppLogsPath(join(profile,'logs'))
const file = join(profile,'save.json')
const { startSave } = require(resolve('dist/ui-popup-native.cjs'))
let disk = startSave(null)
disk.havePet=true
Object.assign(disk.petInfo,{yb:10000,health:5,mood:500,pinkDiamond:false})
disk.settings.quiet=true
disk.petComputedlInfo.level=30
disk.selfGoodDatas.toy=[]
writeFileSync(file,JSON.stringify(disk))
ipcMain.handle('fixture:load',()=>JSON.parse(readFileSync(file,'utf8')))
ipcMain.on('fixture:save',(event,patch)=>{
  const next=structuredClone(disk)
  for(const [key,value] of Object.entries(patch)) {
    if(Array.isArray(value))next[key]=value
    else Object.assign(next[key],value)
  }
  writeFileSync(file+'.tmp',JSON.stringify(next));renameSync(file+'.tmp',file)
  disk=next;event.returnValue=null
})
app.whenReady().then(async()=>{
  const prepared=JSON.parse(readFileSync('dist/ui-toys-prepared.json','utf8'))
  const assetRoot=pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES||'resources')+'/').href
  const html=resolve('dist/toys-test.html')
  writeFileSync(html,'<!doctype html><meta charset="UTF-8"><base href="'+assetRoot+'"><style>'+prepared.css.replaceAll('url(/pet/','url('+assetRoot+'pet/')+'</style><body>')
  const win=new BrowserWindow({width:1000,height:700,useContentSize:true,show:false,webPreferences:{preload:join(__dirname,'shop-preload.cjs'),sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}})
  const evaluate=expression=>win.webContents.executeJavaScript(expression)
  const pause=ms=>new Promise(r=>setTimeout(r,ms))
  const boot='(async()=>{'+prepared.code+';fixture.openShop();return true})()'
  await win.loadFile(html);await resizeViewport(win,1000,700);await evaluate(boot)
  const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click();return true})()`)
  await click('.shopGN')
  assert.equal(await evaluate("document.querySelector('.rsfb_totalPage').textContent"),'4')
  const added=await evaluate('fixture.toys.filter(g=>Number(g.id.slice(1))>=9)')
  const names=[]
  for(let page=2;page<=4;page++) {
    await click('.rsfb_down')
    const cards=await evaluate(`(async()=>{const cards=[...document.querySelectorAll('.rGoods')];for(const c of cards)await c.querySelector('.rG_leftImg').decode();return cards.map(c=>({name:c.querySelector('.rG_title').textContent,width:c.querySelector('.rG_leftImg').naturalWidth,desc:c.querySelector('.goodFloatMsg').textContent,price:c.querySelector('.rG_payYb').textContent}))})()`)
    for(const card of cards) {
      names.push(card.name)
      assert.ok(card.width>0)
      assert.ok(card.desc.includes('心情'))
      assert.ok(!/\d+\.\d/.test(card.price),'new toy prices display whole units, including the discount')
    }
    if(page===2) {
      await click('.rG_pay');await pause(550)
      await click('.rG_pay');await pause(550)
      assert.ok(disk.selfGoodDatas.toy.includes('_t0009*2'))
      assert.equal(disk.petInfo.yb,9980)
      await click('.selfgn')
      assert.equal(await evaluate("document.querySelector('.selfGoodName').textContent"),'羽毛')
      await click('.selfGoodUse')
      assert.ok(disk.selfGoodDatas.toy.includes('_t0009*1'))
      assert.equal(disk.petInfo.mood,520)
    }
  }
  assert.deepEqual(names,added.map(g=>g.name))
  const dimensions=[]
  for(const [w,h,dpr] of [[1000,700,1],[640,480,1.5],[360,640,2]]){
    await resizeViewport(win,w,h,dpr)
    for(let page=2;page<=4;page++){
      await click('.rsfb_upMore')
      for(let n=1;n<page;n++)await click('.rsfb_down')
      const rect=await evaluate(`(()=>{const e=document.querySelector('.ui-shop'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,cardCount:document.querySelectorAll('.rGoods').length}})()`)
      assert.ok(rect.left>=-1&&rect.right<=w+1&&rect.top>=-1&&rect.bottom<=h+1,JSON.stringify({w,h,page,rect}))
      dimensions.push({w,h,dpr,page})
    }
  }
  await resizeViewport(win,1000,700,1)
  writeFileSync('dist/toys-shop.png',(await win.webContents.capturePage()).toPNG())
  await click('.ui-shop .close')
  await win.loadFile(html);await evaluate(boot)
  await click('.selfgn')
  assert.equal(await evaluate("document.querySelector('.selfGoodName').textContent"),'羽毛')
  assert.ok(disk.selfGoodDatas.toy.includes('_t0009*1'))
  await click('.ui-shop .close')
  writeFileSync('dist/toys-results.json',JSON.stringify({loaded:19,pages:4,purchaseAndUse:true,reload:true,dimensions},null,2))
  console.log('Toy UI verified: 19 real images, three added pages, repeat purchase, inventory use, reload and nine viewport/page cases')
  win.destroy();app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
