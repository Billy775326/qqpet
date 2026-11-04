const {app,BrowserWindow,ipcMain}=require('electron')
const {readFileSync,writeFileSync,mkdtempSync}=require('node:fs')
const {resolve,join}=require('node:path')
const {pathToFileURL}=require('node:url')
const {execFileSync}=require('node:child_process')
const assert=require('node:assert/strict')
const {resizeViewport}=require('./viewport.cjs')
const {menuPriority,startSave}=require(resolve('dist/ui-popup-native.cjs'))
const profile=mkdtempSync(resolve('dist/popups-profile-'))
app.setPath('userData',profile);app.setPath('sessionData',profile);app.setAppLogsPath(join(profile,'logs'))
// The suite switches from offscreen DOM checks to separate native windows.
app.on('window-all-closed',()=>{})
const disk=startSave(null);disk.havePet=true
const priorityEvents=[]
ipcMain.handle('fixture:load',()=>structuredClone(disk))
ipcMain.on('fixture:save',(e,patch)=>{for(const[k,v]of Object.entries(patch))Object.assign(disk[k],v);e.returnValue=null})
ipcMain.on('fixture:status-priority',(_e,on)=>priorityEvents.push(on))
app.whenReady().then(async()=>{
 const prepared=JSON.parse(readFileSync('dist/ui-popups-prepared.json','utf8'))
 const assetRoot=pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES||'resources')+'/').href
 const html=resolve('dist/popups-test.html')
 const page=css=>'<!doctype html><meta charset="UTF-8"><base href="'+assetRoot+'"><style>'+css.replaceAll('url(/pet/','url('+assetRoot+'pet/')+'</style><body>'
 writeFileSync(html,page(prepared.css))
 const win=new BrowserWindow({width:800,height:560,useContentSize:true,show:false,webPreferences:{preload:join(__dirname,'shop-preload.cjs'),sandbox:true,contextIsolation:true,offscreen:true,backgroundThrottling:false}})
 const evaluate=code=>win.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms))
 await win.loadFile(html);await resizeViewport(win,800,560);await evaluate(prepared.setup+'\n'+prepared.code+';true')
 const cdp=(method,params)=>win.webContents.debugger.sendCommand(method,params)
 await cdp('DOM.enable');await cdp('CSS.enable')
 const root=(await cdp('DOM.getDocument')).root.nodeId
 const hover=async(index,on)=>{const {nodeId}=await cdp('DOM.querySelector',{nodeId:root,selector:'.menuItem:nth-child('+index+')'});await cdp('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:on?['hover']:[]});await evaluate('fixture.reflow()')}
 const rects=()=>evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}};return {bubble:rect(document.querySelector('#talk')),controls:[rect(document.querySelector('.menus')),...[...document.querySelectorAll('.childrenMenu')].filter(e=>e.parentElement.matches(':hover')&&getComputedStyle(e).display!=='none').map(rect)]}})()`)
 const cases=[]
 for(const[w,h]of[[1920,1040],[800,560],[320,480]]){
  await resizeViewport(win,w,h)
  for(const[x,y]of[[w/2,h/2],[0,30],[w-120,h-160]]){
   await evaluate('fixture.position('+x+','+y+');fixtureSay()')
   const baselineBubble=(await rects()).bubble
   const original=await evaluate(`(()=>{const s=fixture.state(),body=s.body,y=parseFloat(document.querySelector('.control').style.top),lift=s.placement==='above'?Math.max(0,Math.max(0,s.action.top)-y):0;return {left:Math.max(0,Math.min((body.left+body.right-261)/2,innerWidth-261)),top:Math.max(0,Math.min(body.top<183?body.bottom:body.top-183-lift,innerHeight-183))}})()`)
   assert.ok(Math.abs(baselineBubble.left-original.left)<.1&&Math.abs(baselineBubble.top-original.top)<.1,'speech retains its original pet-relative placement')
   for(const index of[1,2,3,4,5]){
    await hover(index,true)
    const boxes=await rects()
    assert.ok(boxes.bubble.left>=-.1&&boxes.bubble.top>=-.1&&boxes.bubble.right<=w+.1&&boxes.bubble.bottom<=h+.1,'speech stays inside the work area')
    assert.deepEqual(boxes.bubble,baselineBubble,'opening flyouts must not move the speech bubble')
    await hover(index,false)
    assert.deepEqual((await rects()).bubble,baselineBubble,'closing flyouts must not move the speech bubble')
   }
   const button=await evaluate(`(()=>{const r=document.querySelector('.bubbleTestButton').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
   assert.equal(await evaluate(`document.elementFromPoint(${button.x},${button.y}).className`),'bubbleTestButton','speech confirmation receives input')
   for(const type of['mousePressed','mouseReleased'])await cdp('Input.dispatchMouseEvent',{type,...button,button:'left',clickCount:1})
   assert.equal(await evaluate("document.querySelector('#talk').style.visibility"),'hidden')
   cases.push({w,h,x,y})
  }
 }
 await resizeViewport(win,800,560);await evaluate('fixture.position(340,180);fixtureSay()');await hover(2,true);await pause(200)
 writeFileSync('dist/popups-bubble.png',(await win.webContents.capturePage()).toPNG())
 // Force an overlap to check the fallback stacking order and actual hit target.
 await evaluate(`(()=>{const b=document.querySelector('#talk'),r=document.querySelector('.menus').getBoundingClientRect();b.style.left=r.left+'px';b.style.top=r.top+'px'})()`)
 assert.equal(await evaluate(`(()=>{const b=document.querySelector('#talk').getBoundingClientRect();return document.elementFromPoint(b.left+12,b.top+12).closest('#talk')?.id})()`),'talk')
 const statePrepared=JSON.parse(readFileSync('dist/ui-sweetheart-prepared.json','utf8'))
 writeFileSync(html,page(statePrepared.css));await win.loadFile(html);await resizeViewport(win,800,560);await evaluate('(async()=>{'+statePrepared.code+';return true})()')
 const opened=async()=>{await evaluate('fixture.openState(740,600)');await pause(40);assert.equal(priorityEvents.at(-1),true)}
 const closed=async expression=>{await evaluate(expression);await pause(40);assert.equal(await evaluate("document.querySelectorAll('.PetStateInfo').length"),0);assert.equal(priorityEvents.at(-1),false)}
 await opened();await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});assert.equal(await evaluate("document.querySelectorAll('.PetStateInfo').length"),1,'moving from the tray does not dismiss status')
 await closed("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
 await opened();await closed("document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))")
 await opened();await closed("window.dispatchEvent(new Event('blur'))")
 await opened();await evaluate('fixture.openState(740,600)');await pause(40);assert.deepEqual(priorityEvents.slice(-2),[false,true])
 await closed("document.querySelector('.PetStateInfo .close').click()")
 const count=priorityEvents.length;await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");await pause(40);assert.equal(priorityEvents.length,count,'closing removes stale handlers')
 win.destroy()
 let native=null
 if(process.platform==='win32'){
  const shell=new BrowserWindow({show:false,skipTaskbar:true,x:30,y:30,width:200,height:160,opacity:.01})
  const popup=new BrowserWindow({show:false,skipTaskbar:true,focusable:false,x:30,y:30,width:200,height:160,opacity:.01})
  try{
   shell.setAlwaysOnTop(true);shell.showInactive()
   const priority=menuPriority(popup);priority.reveal('state');shell.moveTop();priority.reveal('state');await pause(150)
   const hwnd=popup.getNativeWindowHandle().readBigUInt64LE(),other=shell.getNativeWindowHandle().readBigUInt64LE()
   const script=`Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PopupOrder {
 [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c,string n);
 public static bool Above(long first,long second){for(var h=GetTopWindow(IntPtr.Zero);h!=IntPtr.Zero;h=GetWindow(h,2)){if(h.ToInt64()==first)return true;if(h.ToInt64()==second)return false;}throw new Exception("Test windows missing");}
}
'@
$tray=[PopupOrder]::FindWindow('Shell_TrayWnd',$null)
@{overflow=[PopupOrder]::Above(${hwnd},${other});taskbar=if($tray -ne [IntPtr]::Zero){[PopupOrder]::Above(${hwnd},$tray.ToInt64())}else{$null}}|ConvertTo-Json -Compress`
   native=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000}).trim())
   assert.equal(native.overflow,true,'native status must rise above a topmost overflow window')
   if(native.taskbar!==null)assert.equal(native.taskbar,true,'native status must rise above the Windows taskbar')
   priority.setOpen(true,'menu');priority.setOpen(false,'state');assert.ok(popup.isAlwaysOnTop())
   priority.setOpen(false,'menu');assert.equal(popup.isAlwaysOnTop(),false);assert.equal(popup.isFocusable(),false)
  }finally{popup.destroy();shell.destroy()}
 }
 const report={speechCases:cases.length,flyoutCases:cases.length*5,originalPosition:true,speechButtons:true,stacking:true,statusLifecycle:true,native}
 writeFileSync('dist/popups-results.json',JSON.stringify(report,null,2));console.log('Popup priority passed:',JSON.stringify(report));app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
