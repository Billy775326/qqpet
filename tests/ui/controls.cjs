const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync, mkdirSync, mkdtempSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const profile = mkdtempSync(resolve('dist/source-control-profile-'))
mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.setAppLogsPath(join(profile, 'logs'))
app.whenReady().then(async () => {
  const prepared=JSON.parse(readFileSync('dist/ui-controls-prepared.json','utf8'))
  const {setup,css}=prepared
  const win = new BrowserWindow({ width: 1920, height: 1040, useContentSize: true, show: false, webPreferences: { sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, details) => { if(details?.level==='error'||details?.level===3) console.error('Fixture renderer:',details.message) })
  const html = resolve('dist/source-control-test.html')
  const assetRoot=pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES||'resources')+'/').href
  writeFileSync(html,'<!doctype html><html><head><meta charset="UTF-8"><base href="'+assetRoot+'"><style>'+css.replaceAll('url(/pet/','url('+assetRoot+'pet/')+'</style></head><body></body></html>')
  await win.loadFile(html)
  await win.webContents.executeJavaScript(setup + '\n'+prepared.code+';true')
  win.webContents.debugger.attach('1.3')
  const cdp = (method, params) => win.webContents.debugger.sendCommand(method, params)
  await cdp('DOM.enable'); await cdp('CSS.enable')
  const root = (await cdp('DOM.getDocument')).root.nodeId
  const forceHover = async (selector, on) => {
    const { nodeId } = await cdp('DOM.querySelector', { nodeId: root, selector })
    assert.ok(nodeId, selector)
    await cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: on ? ['hover'] : [] })
    await win.webContents.executeJavaScript('fixture.reflow()')
  }
  const fits = (rect, width, height, label) => {
    assert.ok(rect.width > 0 && rect.height > 0, label + ' has no size')
    assert.ok(rect.x >= 9.5 && rect.y >= 9.5 && rect.right <= width - 9.5 && rect.bottom <= height - 9.5, label + ' outside viewport: ' + JSON.stringify(rect))
  }

  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y))
  const results=[]
  for(const [width,height] of [[1920,1040],[800,560],[320,480],[480,360]]){
    win.setContentSize(width,height)
    await new Promise(r=>setTimeout(r,50))
    for(const [name,x,y] of [['top-left',0,0],['top-right',width-146,0],['bottom-left',0,height-146],['bottom-right',width-146,height-146],['left',0,(height-146)/2],['right',width-146,(height-146)/2],['top',width/2-73,0],['bottom',width/2-73,height-146],['center',width/2-73,height/2-73]]){
      await win.webContents.executeJavaScript(`fixture.position(${x},${y})`)
      const baseline=await win.webContents.executeJavaScript('fixture.state()')
      fits(baseline.row,width,height,name+' primary controls')
      const body={x:Math.max(0,baseline.action.left),y:Math.max(0,baseline.action.top),right:Math.min(width,baseline.action.right),bottom:Math.min(height,baseline.action.bottom)}
      assert.equal(overlap(baseline.row,body),0,name+' controls overlap animation canvas')
      const clearances={left:body.x-baseline.row.right,right:baseline.row.x-body.right,above:body.y-baseline.row.bottom,below:baseline.row.y-body.bottom};
      assert.ok(clearances[baseline.placement]>=9.5,name+' animation clearance is less than 10 px: '+JSON.stringify(clearances))
      const vertical=baseline.layout==='vertical'
      assert.ok(Math.abs((vertical?baseline.row.height:baseline.row.width)-192)<.2,'six controls must use a compact 192 px span')
      for(let i=1;i<6;i++){const p=baseline.icons[i-1],n=baseline.icons[i];const gap=vertical?n.y-p.bottom:n.x-p.right;assert.ok(gap<=4.2,'artwork still has excessive gaps: '+gap)}
      if(['top-left','top-right','bottom-left','bottom-right','left','right'].includes(name))assert.equal(vertical,true,name+' must use a column')
      if(['top','bottom'].includes(name))assert.equal(vertical,false,name+' must use a row')
      for(let i=0;i<6;i++){
        const item=baseline.items[i]
        assert.ok(Math.abs(item.width-32)<.1&&Math.abs(item.height-32)<.1,'fixed hit-box dimensions')
        if(i){const previous=baseline.items[i-1];const gap=vertical?item.y-previous.bottom:item.x-previous.right;assert.ok(Math.abs(gap)<.2,name+' inconsistent primary gap: '+gap)}
        await forceHover('.menuItem:nth-child('+(i+1)+')',true)
        await new Promise(r=>setTimeout(r,170))
        const hover=await win.webContents.executeJavaScript('fixture.state()')
        for(let j=0;j<6;j++){
          assert.ok(Math.abs(hover.items[j].x-baseline.items[j].x)<.2&&Math.abs(hover.items[j].y-baseline.items[j].y)<.2,name+' hovering moved another control')
          assert.ok(hover.icons[j].width<=32.1&&hover.icons[j].height<=32.1,name+' icon spills beyond its hit box')
        }
        const index=[0,2,3,4].indexOf(i)
        if(index>=0){
          const child=hover.children[index]
          fits(child,width,height,name+' flyout '+i)
          assert.ok(overlap(child,hover.row)<.5,name+' flyout covers primary controls')
          assert.ok(overlap(child,body)<.5,name+' flyout covers pet')
          for(let j=1;j<child.rows.length;j++)assert.ok(Math.abs(child.rows[j].y-child.rows[j-1].bottom-2)<.2,'inconsistent flyout row gap')
          if(vertical&&name.includes('left'))assert.equal(child.direction,'right')
          if(vertical&&name.includes('right'))assert.equal(child.direction,'left')
        }
        await forceHover('.menuItem:nth-child('+(i+1)+')',false)
      }
      await win.webContents.executeJavaScript('fixture.panel()')
      let panel=await win.webContents.executeJavaScript('fixture.state()')
      fits(panel.panel,width,height,name+' inventory')
      await forceHover('.goodItemIconBox',true)
      panel=await win.webContents.executeJavaScript('fixture.state()')
      assert.equal(panel.tips.length,1);fits(panel.tips[0],width,height,name+' item details')
      await forceHover('.goodItemIconBox',false)
      await win.webContents.executeJavaScript('fixture.closePanel()')
      const closed=await win.webContents.executeJavaScript('fixture.state()')
      assert.equal(closed.layout,baseline.layout,'closing panel changed control orientation')
      assert.ok(Math.abs(closed.row.x-baseline.row.x)<.2&&Math.abs(closed.row.y-baseline.row.y)<.2,'closing panel moved the controls')
      results.push({width,height,position:name,layout:baseline.layout,placement:baseline.placement,barLength:vertical?baseline.row.height:baseline.row.width,gap:vertical?baseline.items[1].y-baseline.items[0].bottom:baseline.items[1].x-baseline.items[0].right,status:'passed'})
    }
    console.log('Adaptive controls checked at',width,height)
  }
  // Inspect real artwork in an isolated fixture, with a marked pet silhouette.
  win.setContentSize(720,500)
  await win.webContents.executeJavaScript(`fixture.position(0,177);(()=>{const b=fixture.state().action,e=document.createElement('div');e.textContent='动画画布范围';Object.assign(e.style,{position:'absolute',left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',border:'1px dashed #888',color:'#666',fontSize:'10px'});document.body.append(e)})()`)
  await forceHover('.menuItem:nth-child(1)',true)
  await new Promise(r=>setTimeout(r,200))
  const image=await win.webContents.capturePage()
  writeFileSync('dist/source-control-fixture.png',image.toPNG())
  writeFileSync('dist/source-control-test-results.json',JSON.stringify({cases:results.length,checks:'full animation canvas clearance of 10 px, compact 192 px span, stable hover positions, no flyout/action overlaps, edges and center, inventory switching',results},null,2))
  console.log('Adaptive controls passed',results.length,'viewport and position combinations')
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
