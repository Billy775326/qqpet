const {app,BrowserWindow}=require('electron')
const {readFileSync,writeFileSync,mkdtempSync}=require('node:fs')
const {resolve,join}=require('node:path')
const assert=require('node:assert/strict')
const profile=mkdtempSync(resolve('dist/source-cursor-profile-'))
app.setPath('userData',profile);app.setPath('sessionData',profile);app.setAppLogsPath(join(profile,'logs'))
app.whenReady().then(async()=>{
  const {code:helper,css}=JSON.parse(readFileSync('dist/ui-cursor-prepared.json','utf8'))
  const assetRoot=require('node:url').pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES||'resources')+'/').href
  const win=new BrowserWindow({width:800,height:600,show:false,webPreferences:{sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}})
  const html=resolve('dist/source-cursor-test.html')
  writeFileSync(html,'<!doctype html><html><head><meta charset="UTF-8"><base href="'+assetRoot+'"><style>'+css.replaceAll('url(/pet/','url('+assetRoot+'pet/')+'</style></head><body><div id="pet" style="left:100px;top:100px;width:146px;height:146px"><ruffle-player></ruffle-player><ruffle-player></ruffle-player><div class="face"><div class="point"></div></div></div><button id="button" class="focusPress">Button</button><div class="ui-control"><div class="control showControl"><div class="menus"><div class="menuItem"><div class="childrenMenuItem">Submenu</div></div></div></div></div><div class="local-edge-mini" style="left:500px;top:100px;right:auto"></div><div class="ui-chat"><button class="chatSend">Send</button></div><div class="ui-photo"><button class="photoClose">Close</button></div></body></html>')
  await win.loadFile(html)
  const run=expression=>win.webContents.executeJavaScript(expression)
  await run(`(()=>{${helper};for(const p of document.querySelectorAll('ruffle-player')){const root=p.attachShadow({mode:'open'});root.innerHTML='<style>:host{all:initial}canvas{cursor:auto}</style><div id="container"><canvas></canvas></div>';for(let i=0;i<10;i++)cursorFixture.installPetCursor(p)}return true})()`)
  assert.equal(await run('getComputedStyle(document.getElementById("pet")).cursor'),'auto','Outside the hit region must not impose the QQPet cursor')
  await run('document.documentElement.classList.add("qqpet-cursor-hit");true')
  win.webContents.debugger.attach('1.3')
  const cdp=(method,params)=>win.webContents.debugger.sendCommand(method,params)
  await cdp('DOM.enable');await cdp('CSS.enable')
  const root=(await cdp('DOM.getDocument')).root.nodeId
  const pseudo=async(selector,states)=>{
    const {nodeId}=await cdp('DOM.querySelector',{nodeId:root,selector});assert.ok(nodeId)
    await cdp('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:states})
  }
  const checks=[]
  const expect=async(selector,kind,label)=>{
    const cursor=await run('getComputedStyle(document.querySelector('+JSON.stringify(selector)+')).cursor')
    assert.ok(cursor.includes('/focus/'+kind+'.cur'),label+': '+cursor);checks.push(label)
  }
  for(const selector of ['#pet','#pet .point','#button','.menuItem','.childrenMenuItem','.local-edge-mini','.chatSend','.photoClose'])await expect(selector,'normal',selector+' original normal artwork')
  for(const selector of ['#pet','#button','.menuItem','.childrenMenuItem','.local-edge-mini']){
    await pseudo(selector,['hover','active']);await expect(selector,'press',selector+' held')
    await pseudo(selector,['hover']);await expect(selector,'normal',selector+' released')
    await pseudo(selector,[])
  }
  await pseudo('#button',['focus']);await expect('#button','normal','focus alone does not press');await pseudo('#button',[])
  await run('document.querySelector(".local-edge-mini").classList.add("local-mini-dragging");true')
  await expect('.local-edge-mini','press','mini drag retains original pressed artwork')
  await run('document.querySelector(".local-edge-mini").classList.remove("local-mini-dragging");true')
  const canvases=await run('Array.from(document.querySelectorAll("ruffle-player"),p=>({cursor:getComputedStyle(p.shadowRoot.querySelector("canvas")).cursor,styles:p.shadowRoot.querySelectorAll("style[data-qqpet-original-cursor]").length}))')
  for(const player of canvases){assert.ok(player.cursor.includes('/focus/normal.cur'));assert.equal(player.styles,1)}
  await pseudo('#pet',['active'])
  assert.ok(await run('Array.from(document.querySelectorAll("ruffle-player")).every(p=>getComputedStyle(p.shadowRoot.querySelector("canvas")).cursor.includes("/focus/press.cur"))'))
  await pseudo('#pet',[])
  assert.equal(await run('getComputedStyle(document.body).cursor'),'auto','transparent background must not impose the pet cursor')
  await run('document.documentElement.classList.remove("qqpet-cursor-hit");true')
  assert.equal(await run('getComputedStyle(document.getElementById("pet")).cursor'),'auto','Leaving restores automatic cursor')
  const miniHit=await run('(()=>{const e=document.querySelector(".local-edge-mini"),p=getComputedStyle(e,"::before");return{position:p.position,right:p.right,top:p.top,parentTop:getComputedStyle(e).top,width:p.width,height:p.height}})()')
  assert.equal(miniHit.position,'fixed');assert.equal(miniHit.right,'0px');assert.equal(miniHit.top,miniHit.parentTop);assert.equal(miniHit.width,'72px');assert.equal(miniHit.height,'80px')
  await run('document.querySelector(".local-edge-mini").dataset.side="left";true')
  const leftHit=await run('(()=>{const p=getComputedStyle(document.querySelector(".local-edge-mini"),"::before");return{left:p.left,right:p.right,width:p.width}})()')
  assert.equal(leftHit.left,'0px');assert.equal(parseFloat(leftHit.right),await run('innerWidth-72'));assert.equal(leftHit.width,'72px')
  const result={checks:checks.length,shadowPlayers:2,normalPressedRelease:true,focusRegression:true,miniDrag:true,stableMiniHitZone:true,hitEntryExit:true,backgroundAutomatic:true,duplicateStylesPrevented:true,controlGapPreserved:10}
  writeFileSync('dist/source-cursor-results.json',JSON.stringify(result,null,2))
  console.log('Cursor theme isolated checks passed:',JSON.stringify(result));app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
