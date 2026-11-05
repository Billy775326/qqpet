// Real Ruffle regression using an isolated profile and test-only Flash callback.
// Set QQPET_TEST_JAVA, QQPET_FFDEC_JAR and QQPET_TEST_BROWSER (Chrome/Chromium).
import { createServer } from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../', import.meta.url))
const java = process.env.QQPET_TEST_JAVA
const compiler = process.env.QQPET_FFDEC_JAR
const browser = process.env.QQPET_TEST_BROWSER
assert.ok(java && compiler && browser, 'Set QQPET_TEST_JAVA, QQPET_FFDEC_JAR and QQPET_TEST_BROWSER')
mkdirSync(resolve(root, 'dist'), { recursive: true })
const output = mkdtempSync(resolve(root, 'dist/farm-popup-'))
let source = readFileSync(resolve(root, 'tools/qqfarm/src/com/MyFarm/FarmMain.as'), 'utf8')
source = source.replace('import flash.display.Loader;', 'import flash.display.Loader;\n   import flash.external.ExternalInterface;\n   import flash.events.MouseEvent;')
source = source.replace('super();', 'super();\n         ExternalInterface.addCallback("farmProbe",farmProbe);')
const end = source.lastIndexOf('\n   }')
assert.ok(end > 0)
source = source.slice(0, end) + '\n' + readFileSync(resolve(root, 'tests/ui/farm-popup-probe.as.txt'), 'utf8') + source.slice(end)
writeFileSync(resolve(output, 'FarmMain.as'), source)
execFileSync(java, ['-Djava.awt.headless=true', '-jar', compiler, '-replace', resolve(root, 'resources/pet/qqfarm/Farm.swf'), resolve(output, 'probe.swf'), 'com.MyFarm.FarmMain', resolve(output, 'FarmMain.as')], { windowsHide: true, stdio: 'inherit' })

const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eee}#farm{width:700px;height:550px;margin:20px}ruffle-player{width:100%;height:100%}</style><script src="/ruffle/ruffle.js"></script><div id="farm"></div><script>localStorage.clear();window.player=RufflePlayer.newest().createPlayer();document.querySelector('#farm').append(player);player.ruffle().load({url:'/farm/Farm.swf',base:location.origin+'/farm/',autoplay:'on',splashScreen:false,unmuteOverlay:'hidden',contextMenu:'off',allowScriptAccess:true,fontSources:[location.origin+'/pet/qqfont.ttf'],defaultFonts:{sans:['HappyZcool-2016'],serif:['HappyZcool-2016'],typewriter:['HappyZcool-2016']},logLevel:'error'});</script>`
const server = createServer((req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0])
    if (url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return }
    let file, base
    if (url === '/farm/Farm.swf') file = resolve(output, 'probe.swf')
    else if (url === '/pet/qqfont.ttf') file = resolve(root, 'resources/pet/qqfont.ttf')
    else if (url.startsWith('/farm/')) { base = resolve(root, 'resources/pet/qqfarm'); file = resolve(base, url.slice(6)) }
    else if (url.startsWith('/ruffle/')) { base = resolve(root, 'node_modules/@ruffle-rs/ruffle'); file = resolve(base, url.slice(8)) }
    else { res.writeHead(404); res.end(); return }
    assert.ok(!base || file.startsWith(base + sep), 'Resource must stay inside the fixture root')
    const types = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.swf': 'application/x-shockwave-flash', '.xml': 'application/xml', '.ttf': 'font/ttf', '.png': 'image/png' }
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
    res.end(readFileSync(file))
  } catch (error) { console.error('Farm fixture resource error:', req.url, error.message); res.writeHead(404); res.end() }
})
await new Promise(ok => server.listen(0, '127.0.0.1', ok))
const profile = resolve(output, 'profile')
const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, sequence = 0
const pending = new Map(), errors = [], results = []
try {
  let port
  for (let i = 0; i < 100; i++) {
    try { port = Number(readFileSync(resolve(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); break } catch { await pause(100) } // Chrome writes the endpoint after startup.
  }
  assert.ok(port, 'The isolated browser must start')
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const request = pending.get(message.id)
      if (!request) return
      pending.delete(message.id); clearTimeout(request.timer)
      if (message.error) request.fail(Error(JSON.stringify(message.error)))
      else request.ok(message.result)
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); fail(Error('Browser command timed out: ' + method)) }, 10000)
    pending.set(id, { ok, fail, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const probe = (action = 'state', index = 0) => evaluate('player.farmProbe(' + JSON.stringify(action) + ',' + index + ')')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 650, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/' })
  let ready = false
  for (let i = 0; i < 150; i++) {
    if (await evaluate('typeof player!=="undefined"&&typeof player.farmProbe==="function"')) if ((await probe())?.ready) { ready = true; break }
    await pause(200)
  }
  assert.ok(ready, 'The real farm must finish initialization')
  await probe('open'); await pause(900)
  const original = await probe()
  assert.ok(original.count >= 6)
  const assertPopup = state => {
    assert.equal(state.popups.length, 1)
    const popup = state.popups[0]
    assert.equal(popup.scaleX, 1); assert.equal(popup.scaleY, 1)
    assert.ok(popup.width > 280 && popup.width < 340 && popup.height > 300 && popup.height < 380, JSON.stringify(popup))
    results.push(popup)
  }
  for (let i = 0; i < 6; i++) {
    await probe('item', i); await pause(40); await probe('item', (i + 1) % 6); await pause(1200)
    assertPopup(await probe())
    await probe('cancel'); await probe('cancel'); await probe('item', (i + 2) % 6); await pause(1200)
    const closed = await probe()
    assert.equal(closed.popups.length, 0); assert.equal(closed.children, original.children)
    assert.equal(closed.balance, original.balance, 'Canceling must not spend money')
  }
  // Closing before the illustration is attached must also clean up the modal.
  await probe('item', 0); await pause(40); await probe('cancel'); await pause(1200)
  assert.equal((await probe()).children, original.children)
  await probe('item', 0); await pause(1200)
  const purchase = await probe(); assertPopup(purchase)
  const png = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(resolve(output, 'popup.png'), Buffer.from(png.data, 'base64'))
  await probe('buy'); await probe('buy'); await pause(1200)
  const bought = await probe()
  assert.equal(bought.balance, original.balance - purchase.popups[0].cost, 'Repeated confirmation must buy only once')
  assert.equal(bought.popups.length, 0); assert.equal(bought.successTips, 1)
  assert.equal(bought.children, original.children + 1, 'Only the normal purchase-success message remains')
  await probe('ack')
  assert.equal((await probe()).children, original.children, 'Dismissing success leaves no popup or modal shield')
  assert.deepEqual(errors, [], 'The farm must not log runtime errors')
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ results, earlyCancel: true, singlePurchase: true, cleanup: true }, null, 2))
  console.log('Farm popup regression passed:', output)
  await send('Browser.close')
} finally {
  for (const request of pending.values()) clearTimeout(request.timer)
  socket?.close()
  if (child.exitCode === null) child.kill()
  await new Promise(ok => server.close(ok))
}
