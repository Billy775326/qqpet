const {app,BrowserWindow,ipcMain}=require('electron')
const {readFileSync,writeFileSync,mkdtempSync,symlinkSync,unlinkSync,lstatSync}=require('node:fs')
const {resolve,join}=require('node:path')
const {pathToFileURL}=require('node:url')
const assert=require('node:assert/strict')
const {resizeViewport}=require('./viewport.cjs')
const {startSave,applyPatch}=require(resolve('dist/ui-fishing-save.cjs'))

const root=mkdtempSync(resolve('dist/fishing-startup-'))
app.setPath('userData',join(root,'profile'))
app.setPath('sessionData',join(root,'profile'))
app.setAppLogsPath(join(root,'logs'))
const disk=startSave(null)
disk.havePet=true;disk.petInfo.yb=20;disk.settings.quiet=true
ipcMain.handle('fixture:load',()=>structuredClone(disk))
ipcMain.on('fixture:save',(event,patch)=>{applyPatch(disk,patch);event.returnValue=null})
symlinkSync(resolve(process.env.QQPET_TEST_RESOURCES||'resources','pet'),join(root,'pet'),'junction')
app.on('will-quit',()=>{assert.ok(lstatSync(join(root,'pet')).isSymbolicLink());unlinkSync(join(root,'pet'))})

app.whenReady().then(async()=>{
  const prepared=JSON.parse(readFileSync('dist/ui-fishing-prepared.json','utf8'))
  const html=join(root,'index.html'),ruffle=pathToFileURL(resolve('out/renderer/ruffle/ruffle.js')).href,base=pathToFileURL(root+'/').href
  writeFileSync(html,'<!doctype html><meta charset="UTF-8"><script src="'+ruffle+'"></script><style>'+prepared.css.replaceAll('url(/pet/','url('+base+'pet/')+'</style><body>')
  const win=new BrowserWindow({width:800,height:600,useContentSize:true,show:false,webPreferences:{preload:join(__dirname,'shop-preload.cjs'),sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}})
  win.webContents.setAudioMuted(true)
  const errors=[]
  win.webContents.on('console-message',event=>{if(/Error #|TypeError|ReferenceError|VerifyError/.test(event.message||''))errors.push(event.message)})
  const evaluate=code=>win.webContents.executeJavaScript(code)
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  const wait=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await pause(10)}throw Error('Timed out: '+expression)}
  await win.loadFile(html);await resizeViewport(win,800,600)
  await evaluate('(async()=>{'+prepared.code+';return true})()')
  await evaluate(`window.startupTasks=[];window.startupFrames=[];
    new PerformanceObserver(list=>{for(const entry of list.getEntries())startupTasks.push({start:entry.startTime,duration:entry.duration})}).observe({type:'longtask',buffered:true});
    let previous=performance.now();function frame(now){startupFrames.push({start:previous,duration:now-previous});previous=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
    window.savedSend=()=>{};window.savedQuote=()=>({sentinel:true});window.PETSendData=savedSend;window.QQPetPondStockQuote=savedQuote;true`)
  const samples=[]
  for(let iteration=0;iteration<3;iteration++){
    const start=await evaluate('performance.now()')
    const openMs=await evaluate('(()=>{const start=performance.now();fixture.openFishing();fixture.openFishing();return performance.now()-start})()')
    assert.equal(await evaluate('document.querySelectorAll("ruffle-player").length'),1,'repeated clicks open only one pond')
    await wait('typeof document.querySelector("ruffle-player")?.PETEventOnReceived==="function"')
    const bridgeMs=await evaluate('performance.now()')-start
    await pause(650)
    const sample=await evaluate(`({longTasks:startupTasks.filter(e=>e.start>=${start}).map(e=>e.duration),
      maxFrameMs:Math.max(0,...startupFrames.filter(e=>e.start>=${start}).map(e=>e.duration))})`)
    samples.push({iteration,openMs,bridgeMs,...sample})
    await evaluate('window.close_game(1);true')
    assert.equal(await evaluate('document.querySelectorAll(".ui-fishing,ruffle-player").length'),0)
    assert.equal(await evaluate('window.PETSendData===savedSend&&window.QQPetPondStockQuote===savedQuote'),true)
    await pause(100)
  }
  await evaluate('fixture.openFishing();window.close_game(1);true')
  await pause(300)
  assert.equal(await evaluate('document.querySelectorAll(".ui-fishing,ruffle-player").length'),0,'closing during load leaves no player')
  assert.equal(await evaluate('window.PETSendData===savedSend&&window.QQPetPondStockQuote===savedQuote'),true)
  assert.equal(disk.petInfo.yb,20,'opening and closing never purchases fish')
  assert.deepEqual(errors,[])
  writeFileSync('dist/fishing-startup-results.json',JSON.stringify({electron:process.versions.electron,environment:'isolated offscreen window, 800x600, empty test pond',timing:'open to protocol callback, followed by 650ms observation; not a full-scene-ready measurement',samples},null,2))
  console.log('Pond startup measured; repeated opens, single instance, bridge cleanup and close during load passed:',JSON.stringify(samples))
  win.destroy();app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
