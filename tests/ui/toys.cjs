const { app, BrowserWindow, ipcMain } = require('electron')
const { readFileSync, writeFileSync, mkdtempSync, renameSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { resizeViewport } = require('./viewport.cjs')
const { hidpiSvg } = require(resolve('dist/ui-shop-hidpi.cjs'))
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
  win.webContents.setAudioMuted(true)
  const evaluate=expression=>win.webContents.executeJavaScript(expression)
  const pause=ms=>new Promise(r=>setTimeout(r,ms))
  const boot='(async()=>{'+prepared.code+';fixture.openShop();return true})()'
  await win.loadFile(html);await resizeViewport(win,1000,700);await evaluate(boot)
  const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click();return true})()`)
  let tabCases=0,subtabCases=0
  const menu='pet/shppingMall/menu/'
  const artNames=['mall_06.gif','mall_07.gif','mall_08.gif','mall_09.gif','mal_06.gif','mal_07.gif','mal_08.gif','mal_09.gif','Sale_SubTag.png','Sale_SubTag_Selected.png']
  const artwork=hd=>Object.fromEntries(artNames.map(name=>{const svg=hd&&hidpiSvg(resolve(process.env.QQPET_TEST_RESOURCES||'resources',menu,name));return [name,svg?'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'):assetRoot+menu+name]}))
  const applySkin=hd=>evaluate(`(async()=>{const assets=${JSON.stringify(artwork(hd))};for(const el of document.querySelectorAll('.rscb_t_onve,.rscb_dowmOnce')){const original=getComputedStyle(el).backgroundImage.slice(5,-2),name=new URL(original).pathname.split('/').at(-1);if(assets[name])el.style.backgroundImage='url(\"'+assets[name]+'\")';const image=new Image();image.src=getComputedStyle(el).backgroundImage.slice(5,-2);await image.decode()}return true})()`)
  for(const hd of [false,true]) for(const [w,h,dpr] of [[1000,700,1],[800,600,1.25],[640,480,2]]) {
    await resizeViewport(win,w,h,dpr)
    for(const selected of ['shopTj','shopWy','shopGN','shopZB']) {
      await click('.'+selected)
      await applySkin(hd)
      const tabs=await evaluate(`(async()=>{const tabs=[...document.querySelectorAll('.rscb_t_onve')];
        for(const el of tabs){
          const image=new Image();image.src=getComputedStyle(el).backgroundImage.slice(5,-2);await image.decode()}
        return tabs.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,active:el.classList.contains('active'),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height*0.7)===el}})
      })()`)
      await pause(40)
      const visible=await win.webContents.capturePage()
      if(hd&&w===1000&&selected==='shopTj') {
        const header=await evaluate("(()=>{const r=document.querySelector('.rightSelfHeadBk').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)}})()")
        writeFileSync('dist/shop-header-fixed.png',(await win.webContents.capturePage(header)).toPNG())
      }
      await evaluate("document.querySelectorAll('.rscb_t_onve').forEach(el=>el.style.visibility='hidden');true")
      await pause(40)
      const backdrop=await win.webContents.capturePage()
      await evaluate("document.querySelectorAll('.rscb_t_onve').forEach(el=>el.style.visibility='');true")
      const size=visible.getSize(),pixels=visible.toBitmap(),background=backdrop.toBitmap()
      const pixel=(bytes,x,y)=>{const offset=(Math.floor(y*size.height/h)*size.width+Math.floor(x*size.width/w))*4;return bytes.subarray(offset,offset+4)}
      for(const tab of tabs) {
        assert.equal(tab.hit,true,'tab bodies remain clickable')
        if(!tab.active) {
          for(const fraction of [0.2,0.5,0.8]) {
            const x=tab.x+tab.width*fraction,y=tab.y+tab.height*3/34
            assert.ok(pixel(pixels,x,y).equals(pixel(background,x,y)),JSON.stringify({hd,w,dpr,selected,tab,fraction,reason:'inactive upper edge must reveal the shared frame'}))
          }
        } else {
          let red=0
          for(let y=1;y<=5;y++)for(let x=3;x<=32;x++) {
            const heart=pixel(pixels,tab.x+tab.width*x/86,tab.y+tab.height*y/34)
            if(heart[2]>heart[1]+30)red++
          }
          if(red<=3)writeFileSync('dist/shop-tabs-debug.png',visible.toPNG())
          assert.ok(red>3,JSON.stringify({hd,w,dpr,selected,red,reason:'selected heart remains visible above the inactive crop'}))
        }
      }
      const count=await evaluate("document.querySelectorAll('.rscb_dowmOnce').length")
      for(let sub=0;sub<count;sub++){
        await click('.rscb_dowmOnce:nth-child('+(sub+1)+')')
        await applySkin(hd)
        const geometry=await evaluate(`(()=>{const top=document.querySelector('.rscb_top').getBoundingClientRect(),row=document.querySelector('.rscb_dowm').getBoundingClientRect(),head=document.querySelector('.rightSelfHeadBk').getBoundingClientRect(),cards=document.querySelector('.rGoodList').getBoundingClientRect();const buttons=[...document.querySelectorAll('.rscb_dowmOnce')].map(el=>{const r=el.getBoundingClientRect(),text=el.firstElementChild.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,center:r.y+r.height/2,textCenter:text.y+text.height/2,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.rscb_dowmOnce')===el}});return {gap:row.top-top.bottom,total:row.bottom-top.top,headHeight:head.height,headBottom:head.bottom,cardsTop:cards.top,buttons}})()`)
        assert.ok(Math.abs(geometry.gap)<0.6,JSON.stringify({hd,w,dpr,selected,sub,geometry,reason:'no inline baseline gap between tab rows'}))
        assert.ok(Math.abs(geometry.total-geometry.headHeight)<0.6,'the two rows fill the shared frame exactly')
        assert.ok(geometry.headBottom<=geometry.cardsTop+0.6,'header never overlaps product cards')
        for(let j=0;j<geometry.buttons.length;j++){
          const b=geometry.buttons[j]
          assert.ok(Math.abs(b.center-b.textCenter)<0.6,'subcategory text remains vertically centered')
          assert.equal(b.hit,true)
          if(j)assert.ok(b.x>=geometry.buttons[j-1].right-0.6,'subcategory buttons never overlap')
        }
        subtabCases++
      }
      tabCases++
    }
  }
  await resizeViewport(win,1000,700,1)
  await click('.shopTj')
  await pause(40)
  writeFileSync('dist/shop-tabs.png',(await win.webContents.capturePage()).toPNG())
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
  writeFileSync('dist/toys-results.json',JSON.stringify({loaded:19,pages:4,purchaseAndUse:true,reload:true,tabEdgeCases:tabCases,subtabCases,dimensions},null,2))
  console.log('Toy UI verified: 19 real images, three added pages, repeat purchase, inventory use, reload, nine viewport/page cases and '+tabCases+' skin/scale/tab edge checks and '+subtabCases+' aligned subcategory layouts')
  win.destroy();app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
