// Run the packaged Windows application with a fresh profile, then inspect CDP and disk.
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const root = resolve('dist/win-unpacked')
const data = resolve(root, 'data')
assert.equal(existsSync(data), false, 'smoke test requires a fresh package')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(resolve(root, 'QQPet.exe'), ['--remote-debugging-port=19332'], { env, windowsHide: true, stdio: 'ignore' })
const exited = new Promise(r => child.once('exit', r))
let ws
try {
  let page
  for (let i = 0; i < 60; i++) {
    try { const targets = await (await fetch('http://127.0.0.1:19332/json')).json(); page = targets.find(t => t.type === 'page'); if (page && existsSync(resolve(data,'save.json'))) break } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  assert.ok(page, 'packaged app did not start')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r,j) => { ws.addEventListener('open', r, {once:true}); ws.addEventListener('error',j,{once:true}) })
  let id = 0
  const call = expression => new Promise((resolve,reject) => {
    const n = ++id
    const timer = setTimeout(() => reject(new Error('CDP timeout')), 10000)
    const on = e => { const m=JSON.parse(e.data); if(m.id!==n)return; clearTimeout(timer);ws.removeEventListener('message',on); if(m.error || m.result?.exceptionDetails)reject(new Error(JSON.stringify(m)));else resolve(m.result.result.value) }
    ws.addEventListener('message',on)
    ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))
  })
  const state = await call('(async()=>{window.qqpet.save({petInfo:{name:"portable-smoke"},settings:{aiKey:"DUMMY_SECRET"}});const s=await window.qqpet.load();return {name:s.petInfo.name,key:s.settings.aiKey,ua:navigator.userAgent}})()')
  assert.equal(state.name,'portable-smoke')
  assert.equal(state.key,'DUMMY_SECRET')
  const saved = readFileSync(resolve(data,'save.json'),'utf8')
  assert.equal(JSON.parse(saved).petInfo.name,'portable-smoke')
  assert.equal(saved.includes('DUMMY_SECRET'),false)
  assert.ok(existsSync(resolve(data,'browser')))
  console.log('Packaged portable startup, synchronous save, credential exclusion and browser directory verified',state.ua)
  await call('setTimeout(()=>window.qqpet.quit(),100);true')
  ws.close()
  await Promise.race([exited,new Promise((_,j)=>setTimeout(()=>j(new Error('quit timeout')),10000))])
} finally {
  ws?.close()
  if(child.exitCode===null) { child.kill(); await Promise.race([exited,new Promise(r=>setTimeout(r,2000))]) }
  if(existsSync(data)) renameSync(data,resolve('dist/portable-smoke-data'))
}
