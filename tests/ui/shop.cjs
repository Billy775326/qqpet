const {app,BrowserWindow,ipcMain}=require('electron')
const {readFileSync,writeFileSync,mkdtempSync,renameSync}=require('node:fs')
const {resolve,join}=require('node:path')
const assert=require('node:assert/strict')
const profile=mkdtempSync(resolve('dist/source-shop-profile-'))
app.setPath('userData',profile);app.setPath('sessionData',profile);app.setAppLogsPath(join(profile,'logs'))
const file=join(profile,'fixture-save.json')
let disk={petInfo:{yb:5000,sex:'GG',growth:0,faceClick:0,health:5,lastX:100,lastY:100},settings:{hd:false,opacity:1,faceClick:0,quiet:false,clip:false,aiUrl:'',aiKey:'',aiModel:'',weatherCity:''},petComputedlInfo:{level:1},selfGoodDatas:{food:Array.from({length:13},(_,i)=>({id:String(i),num:1})),clean:[],medicine:[],toy:[],nums:[],background:[]},selfGoodUseOption:{background:null}}
writeFileSync(file,JSON.stringify(disk))
let failNext=false,writes=0
ipcMain.handle('fixture:load',()=>JSON.parse(readFileSync(file,'utf8')))
ipcMain.on('fixture:save',(event,patch)=>{
  if(failNext){failNext=false;event.returnValue='Simulated storage write failure';return}
  try{
    const next=structuredClone(disk)
    for(const [key,value] of Object.entries(patch))Object.assign(next[key],value)
    writeFileSync(file+'.tmp',JSON.stringify(next));renameSync(file+'.tmp',file)
    disk=next;writes++;event.returnValue=null
  }catch(error){event.returnValue=String(error)}
})
app.whenReady().then(async()=>{
  const prepared=JSON.parse(readFileSync('dist/ui-shop-prepared.json','utf8'))
  const boot='(async()=>{'+prepared.code+';return true})()'
  const html=resolve('dist/source-shop-test.html')
  const assetRoot=require('node:url').pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES||'resources')+'/').href
  writeFileSync(html,'<!doctype html><html><head><meta charset="UTF-8"><base href="'+assetRoot+'"><style>'+prepared.css.replaceAll('url(/pet/','url('+assetRoot+'pet/')+'</style></head><body></body></html>')
  const win=new BrowserWindow({width:1000,height:700,useContentSize:true,show:false,webPreferences:{preload:join(__dirname,'shop-preload.cjs'),sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}})
  const evaluate=expression=>win.webContents.executeJavaScript(expression)
  const pause=ms=>new Promise(r=>setTimeout(r,ms))
  await win.loadFile(html);await evaluate(boot)
  win.webContents.debugger.attach('1.3')
  const cdp=(method,params)=>win.webContents.debugger.sendCommand(method,params)
  const click=async selector=>{
    const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p})
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1})
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1})
  }
  const results=[]
  const click648=async(count=10)=>{for(let i=0;i<count;i++)await click('[data-tier="648"]')}
  const hint=()=>evaluate("document.querySelector('.rechargeHint').textContent")
  await evaluate('fixture.openSetup()');await pause(80)
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.ui-setup .lm_once')].map(e=>e.textContent)"),['全局设置','存档','工具','AI','关于'])
  assert.equal(await evaluate("document.querySelector('.ui-setup').textContent.includes('作弊')"),false)
  await evaluate('fixture.closeSetup();fixture.openShop()');await pause(80)
  assert.equal(await evaluate("document.querySelectorAll('.rechargeEntry').length"),1)
  assert.equal(await evaluate("document.querySelectorAll('.rechargePlus').length"),0)
  await click('.balanceAmount')
  assert.equal(await evaluate("document.querySelectorAll('.localRechargeBackdrop').length"),0,'only the 元宝 label opens recharge')
  // The original footer bitmap already contains the arrows; hover images must cover them.
  const arrowPositions=[['upMore',141,37,'first'],['up',180,27,'left'],['down',262,27,'right'],['downMore',291,37,'last']]
  const checkPager=async()=>{
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0})
    assert.deepEqual(await evaluate(`(async()=>{const image=new Image();image.src=getComputedStyle(document.querySelector('.leftSelfFootBk')).backgroundImage.slice(5,-2);await image.decode();return [image.naturalWidth,image.naturalHeight]})()`),[345,42],'footer artwork must actually load')
    const geometry=()=>evaluate(`(()=>{const f=document.querySelector('.leftSelfFootBk').getBoundingClientRect();return [...document.querySelectorAll('.lsfb_pageMsg > :not(.lsfb_text)')].map(e=>{const r=e.getBoundingClientRect();return {x:(r.x-f.x)*345/f.width,y:(r.y-f.y)*42/f.height,width:r.width*345/f.width,height:r.height*42/f.height}})})()`)
    const entry=await evaluate(`(()=>{const f=document.querySelector('.leftSelfFootBk').getBoundingClientRect(),e=document.querySelector('.rechargeEntry'),r=e.getBoundingClientRect();return {x:(r.x-f.x)*345/f.width,y:(r.y-f.y)*42/f.height,width:r.width*345/f.width,height:r.height*42/f.height,background:getComputedStyle(e).backgroundImage}})()`)
    assert.ok(Math.abs(entry.x-35)<.2&&Math.abs(entry.y-10)<.2&&Math.abs(entry.width-33)<.2&&Math.abs(entry.height-24)<.2,'recharge hit area must cover the original 元宝 lettering')
    assert.equal(entry.background,'none','recharge entry preserves the original label artwork')
    const before=await geometry()
    assert.equal(before.length,4)
    for(const [i,[name,x,width,image]] of arrowPositions.entries()){
      const rect=before[i]
      assert.ok(Math.abs(rect.x-x)<.2&&Math.abs(rect.y-11)<.2&&Math.abs(rect.width-width)<.2&&Math.abs(rect.height-22)<.2,'pager hit box must align with the footer artwork: '+name+' '+JSON.stringify(rect))
      const point=await evaluate(`(()=>{const r=document.querySelector('.lsfb_${name}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
      await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point})
      assert.ok((await evaluate(`getComputedStyle(document.querySelector('.lsfb_${name}')).backgroundImage`)).includes('page_'+image+'.png'),'hover must highlight the matching arrow')
      assert.deepEqual(await geometry(),before,'hover must not move pagination')
    }
  }
  await checkPager()
  const currentPage=()=>evaluate("document.querySelector('.lsfb_current').textContent")
  assert.equal(await evaluate("document.querySelector('.lsfb_totalPage').textContent"),'3')
  for(const [arrow,page] of [['up',1],['down',2],['downMore',3],['down',3],['up',2],['upMore',1]]){
    await click('.lsfb_'+arrow);assert.equal(await currentPage(),String(page))
  }
  for(const [tier,gain] of [[6,60],[30,300],[98,980],[198,1980],[328,3280],[648,6480]]){
    const previous=disk.petInfo.yb,beforeWrites=writes
    await click('.rechargeEntry');await pause(60)
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.rechargeTier')].map(e=>Number(e.dataset.tier))"),[6,30,98,198,328,648])
    await click('[data-tier="'+tier+'"]')
    assert.equal(await evaluate('fixture.balance()'),previous,'selecting a tier must not add currency')
    assert.equal(writes,beforeWrites)
    await evaluate('fixture.retainSubmit()')
    await click('.localRecharge .windowViewButSubmit')
    assert.equal(await evaluate('fixture.balance()'),previous+gain)
    assert.equal(disk.petInfo.yb,previous+gain)
    assert.equal(JSON.parse(readFileSync(file,'utf8')).petInfo.yb,previous+gain)
    assert.equal(await evaluate("document.querySelector('.balanceAmount').textContent"),String(previous+gain))
    assert.equal(await evaluate("document.querySelectorAll('.localRechargeBackdrop').length"),0)
    await evaluate('window.staleSubmit.click();window.staleSubmit.click()')
    assert.equal(disk.petInfo.yb,previous+gain,'duplicate and stale clicks must not recharge again')
    assert.equal(writes,beforeWrites+1)
    results.push({tier,gain,status:'passed'})
  }
  const beforeBoost=disk.petInfo.yb,boostWrites=writes
  await click('.rechargeEntry');await click648(9)
  assert.ok((await hint()).includes('1 元 = 10 元宝'),'nine clicks must retain the default rate')
  await click('[data-tier="30"]');await click648(1)
  assert.ok((await hint()).includes('1 元 = 100 元宝'),'the tenth cumulative 648 click unlocks the session rate')
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.rechargeGain')].map(e=>e.textContent)"),['600 元宝','3000 元宝','9800 元宝','19800 元宝','32800 元宝','64800 元宝'])
  assert.ok(await evaluate("document.querySelector('.rechargeStatus').textContent.includes('64800')"))
  assert.equal(disk.petInfo.yb,beforeBoost);assert.equal(writes,boostWrites,'unlocking cannot save or credit currency')
  await click648(1);assert.ok((await hint()).includes('1 元 = 100 元宝'),'extra clicks do not toggle the rate back')
  await evaluate('fixture.retainSubmit();window.staleTier=document.querySelector(".rechargeGrid").lastElementChild')
  await click('.localRecharge .windowViewButSubmit')
  assert.equal(disk.petInfo.yb,beforeBoost+64800);assert.equal(writes,boostWrites+1)
  assert.ok(await evaluate("window.lastSpeech.includes('64800')"),'arrival message matches the credited amount')
  await evaluate('window.staleSubmit.click();window.staleSubmit.click()');assert.equal(disk.petInfo.yb,beforeBoost+64800)
  await click('.rechargeEntry');assert.ok((await hint()).includes('1 元 = 10 元宝'),'successful recharge resets the next dialog')
  await evaluate('for(let i=0;i<10;i++)window.staleTier.click()');assert.ok((await hint()).includes('1 元 = 10 元宝'),'detached cards cannot affect a new session')
  await click('.localRecharge .windowViewBut')
  for(const method of ['cancel','escape','shop']){
    const dismiss=async()=>{
      if(method==='cancel')await click('.localRecharge .windowViewBut')
      else if(method==='escape')await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
      else{await evaluate('fixture.closeShop();fixture.openShop()');await pause(60)}
    }
    await click('.rechargeEntry');await click648(9);await dismiss()
    await click('.rechargeEntry');await click648(1)
    assert.ok((await hint()).includes('1 元 = 10 元宝'),method+' must reset the click count')
    await click648(9);assert.ok((await hint()).includes('1 元 = 100 元宝'))
    await dismiss();await click('.rechargeEntry')
    assert.ok((await hint()).includes('1 元 = 10 元宝'),method+' must reset the boosted rate')
    await click('.localRecharge .windowViewBut')
  }
  const beforeBoostRetry=disk.petInfo.yb
  await click('.rechargeEntry');await click648();failNext=true
  await click('.localRecharge .windowViewButSubmit')
  assert.equal(disk.petInfo.yb,beforeBoostRetry);assert.ok((await hint()).includes('1 元 = 100 元宝'),'save failure retains the open dialog rate')
  await click('.localRecharge .windowViewButSubmit');assert.equal(disk.petInfo.yb,beforeBoostRetry+64800)
  const saved=disk.petInfo.yb
  await click('.rechargeEntry');await click('[data-tier="648"]');await click('.localRecharge .windowViewBut')
  assert.equal(disk.petInfo.yb,saved,'cancelling must not change the balance')
  await click('.rechargeEntry');await evaluate('document.querySelector(".rechargeEntry").click()')
  assert.equal(await evaluate("document.querySelectorAll('.localRechargeBackdrop').length"),1,'opening twice must not duplicate dialogs')
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
  assert.equal(await evaluate("document.querySelectorAll('.localRechargeBackdrop').length"),0)
  await click('.rechargeEntry');failNext=true
  await click('.localRecharge .windowViewButSubmit')
  assert.equal(await evaluate('fixture.balance()'),saved)
  assert.equal(disk.petInfo.yb,saved)
  assert.ok(await evaluate("document.querySelector('.rechargeStatus').textContent.includes('保存失败')"))
  await click('.localRecharge .windowViewButSubmit')
  assert.equal(disk.petInfo.yb,saved+60,'a failed save must remain retryable')
  await evaluate('fixture.setBalance(2147483640)');await click('.rechargeEntry')
  await click('.localRecharge .windowViewButSubmit')
  assert.equal(disk.petInfo.yb,2147483640,'recharge must not overflow the save integer')
  assert.ok(await evaluate("document.querySelector('.rechargeStatus').textContent.includes('上限')"))
  await click648();await click('[data-tier="6"]');await click('.localRecharge .windowViewButSubmit')
  assert.equal(disk.petInfo.yb,2147483640,'boosted recharge must also respect the save integer limit')
  await click('.localRecharge .windowViewBut');await evaluate('fixture.setBalance(5000)')
  const layouts=[]
  for(const [width,height] of [[1920,1040],[1000,700],[800,560],[480,360],[320,480]]){
    win.setContentSize(width,height);await pause(80)
    await evaluate('fixture.setBalance(2147483647)')
    const footer=await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}};return {entry:rect(document.querySelector('.rechargeEntry')),amount:rect(document.querySelector('.balanceAmount')),pager:rect(document.querySelector('.lsfb_pageMsg'))}})()`)
    assert.ok(footer.entry.right<=footer.amount.x+0.2,'recharge label overlaps balance')
    assert.ok(footer.amount.right<=footer.pager.x+0.2,'balance overlaps pagination')
    await checkPager()
    await evaluate('fixture.setBalance(5000)')
    await click('.rechargeEntry');await pause(80)
    const layout=await evaluate(`(()=>{const v=document.querySelector('.localRecharge'),r=v.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,cards:[...v.querySelectorAll('.rechargeTier')].map(e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,right:q.right,bottom:q.bottom}}),background:getComputedStyle(v.closest('.backgroundImage')).backgroundImage}})()`)
    assert.ok(layout.x>=7.5&&layout.y>=7.5&&layout.right<=width-7.5&&layout.bottom<=height-7.5,'recharge dialog outside viewport')
    assert.ok(layout.background.includes('windowTip/alert/bg.png'))
    assert.ok(Math.abs(layout.cards[0].y-layout.cards[2].y)<.2&&layout.cards[3].y>layout.cards[0].bottom,'tiers must use two rows of three')
    await click648()
    assert.ok(await evaluate("[...document.querySelectorAll('.rechargeTier')].every(card=>card.querySelector('.rechargeGain').scrollWidth<=card.clientWidth)"),'boosted amounts must fit the existing cards')
    await click('.localRecharge .windowViewBut')
    layouts.push({width,height,status:'passed'})
  }
  await click('.rechargeEntry');await evaluate('fixture.retainSubmit();fixture.closeShop();window.staleSubmit.click()')
  assert.equal(await evaluate("document.querySelectorAll('.localRechargeBackdrop').length"),0)
  assert.equal(disk.petInfo.yb,5000,'closing the shop must invalidate the recharge dialog')
  await evaluate('fixture.openShop()');await pause(60);await click('.rechargeEntry');await click('[data-tier="98"]');await click('.localRecharge .windowViewButSubmit')
  assert.equal(disk.petInfo.yb,5980)
  await win.loadFile(html);await evaluate(boot+'')
  assert.equal(await evaluate('fixture.balance()'),5980,'balance must survive reloading the renderer from the isolated save')
  win.setContentSize(1000,700);await evaluate('fixture.openShop()');await pause(100)
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0})
  writeFileSync('dist/source-shop-pager.png',(await win.webContents.capturePage()).toPNG())
  await checkPager()
  writeFileSync('dist/source-shop-pager-hover.png',(await win.webContents.capturePage()).toPNG())
  await click('.rechargeEntry');await pause(100)
  await click648();writeFileSync('dist/source-shop-fixture.png',(await win.webContents.capturePage()).toPNG())
  writeFileSync('dist/source-shop-results.json',JSON.stringify({tiers:results,layoutCases:layouts,checks:['pager hover matches footer artwork','three-page navigation and page bounds','maximum balance and recharge label do not overlap pager','cheat tab removed','exact six tiers','selection and cancel preserve balance','1:10 and 1:100 credits saved and redrawn','tenth cumulative 648 activation unlocks without crediting','all close paths reset rate and count','stale cards and duplicate submits guarded','single dialog','Escape closes','save failure retains rate and retries','integer limit guarded at both rates','shop close cleans up','balance survives renderer reload'],persistedBalance:disk.petInfo.yb},null,2))
  console.log('Shop passed: aligned pager hover and three-page navigation, 6 recharge tiers, 5 viewport sizes, session boost boundary and reset, persistence, failure, cancellation and lifecycle checks')
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
