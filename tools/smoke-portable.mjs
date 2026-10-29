// Verify the real packaged Windows keyring across three application launches.
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const root=resolve('dist/win-unpacked'), data=resolve(root,'data')
assert.equal(existsSync(data),false,'fresh packaged profile required')
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
let child, exited, ws
try {
  for(let phase=0;phase<3;phase++) {
    child=spawn(resolve(root,'QQPet.exe'),['--remote-debugging-port=19332'],{env,windowsHide:true,stdio:'ignore'})
    exited=new Promise(r=>child.once('exit',r))
    let page
    for(let i=0;i<60;i++) {
      try { const targets=await(await fetch('http://127.0.0.1:19332/json')).json();page=targets.find(t=>t.type==='page');if(page&&existsSync(resolve(data,'save.json')))break }catch{}
      await new Promise(r=>setTimeout(r,500))
    }
    assert.ok(page,'packaged application did not start')
    ws=new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})})
    let id=0
    const call=expression=>new Promise((resolve,reject)=>{
      const n=++id,timer=setTimeout(()=>reject(new Error('CDP timeout')),10000)
      const on=e=>{const m=JSON.parse(e.data);if(m.id!==n)return;clearTimeout(timer);ws.removeEventListener('message',on);if(m.error||m.result?.exceptionDetails)reject(new Error(JSON.stringify(m)));else resolve(m.result.result.value)}
      ws.addEventListener('message',on);ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))
    })
    for(let i=0;i<30;i++){if(await call('typeof window.qqpet === "object"'))break;await new Promise(r=>setTimeout(r,200))}
    if(phase===0) {
      await call('window.qqpet.save({havePet:true,petInfo:{name:"portable-smoke"},settings:{aiKey:"DUMMY_SECRET"}});true')
      assert.ok(existsSync(resolve(data,'credentials.bin')),'real Windows keyring did not save')
      assert.equal(readFileSync(resolve(data,'credentials.bin')).includes(Buffer.from('DUMMY_SECRET')),false)
    }
    const state=await call('(async()=>{const s=await window.qqpet.load();return {name:s.petInfo.name,key:s.settings.aiKey,status:await window.qqpet.keyStorage()}})()')
    assert.equal(state.name,'portable-smoke')
    assert.equal(state.key,phase===2?'':'DUMMY_SECRET')
    assert.equal(readFileSync(resolve(data,'save.json'),'utf8').includes('DUMMY_SECRET'),false)
    assert.ok(existsSync(resolve(data,'browser')))
    if(phase===1) {await call('window.qqpet.save({settings:{aiKey:""}});true');assert.equal(existsSync(resolve(data,'credentials.bin')),false)}
    console.log('Portable keyring phase passed',phase)
    await call('setTimeout(()=>window.qqpet.quit(),100);true');ws.close()
    await Promise.race([exited,new Promise((_,j)=>setTimeout(()=>j(new Error('quit timeout')),10000))])
    await new Promise(r=>setTimeout(r,1000))
  }
  console.log('Actual Windows encrypted key persistence, restart recovery, clearing and save exclusion verified')
} finally {
  ws?.close()
  if(child?.exitCode===null){child.kill();await Promise.race([exited,new Promise(r=>setTimeout(r,2000))])}
  if(existsSync(data))for(let i=0;;i++)try{renameSync(data,resolve('dist/portable-smoke-data'));break}catch(e){if(i>=59||!['EPERM','EBUSY','EACCES'].includes(e.code))throw e;await new Promise(r=>setTimeout(r,500))}
}
