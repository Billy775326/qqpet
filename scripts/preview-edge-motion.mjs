import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { prepareMini } from '../tests/ui/prepare-mini.mjs'
import { prepareEdgeIdle } from '../tests/ui/prepare-edge-idle.mjs'

export function writeEdgePreview() {
  const assets = pathToFileURL(resolve(process.env.QQPET_TEST_RESOURCES || 'resources') + '/').href
  const mini = JSON.parse(readFileSync('dist/ui-mini-prepared.json', 'utf8'))
  const idle = JSON.parse(readFileSync('dist/ui-edge-idle-prepared.json', 'utf8'))
  const page = (fixture, script) => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><base href="${assets}"><style>
  ${fixture.css.replaceAll('url(/pet/', 'url(' + assets + 'pet/')}
  html,body{background:#edf5fa!important}#pet>ruffle-player img{width:100%;height:100%}
  </style><body><div id="pet" data-hit><ruffle-player><img src="pet/avatar/GGKid.png" alt=""></ruffle-player><div class="face"></div></div><script>
  ${fixture.setup}
  ${fixture.code}
  ${script}
  </script></body></html>`
  writeFileSync('dist/edge-mini-preview.html', page(mini, `
  fixture.mini();document.addEventListener('pointermove', e=>fixture.cursor({x:e.clientX,y:e.clientY}));
  document.addEventListener('pointerout',e=>{if(!e.relatedTarget)fixture.cursor({x:-1000,y:-1000})});
  `))
  writeFileSync('dist/edge-taskbar-preview.html', page(idle, `
  const nativeFrame=window.__nativeFrame,nativeNow=window.__nativeNow;
  let previous=nativeNow();
  let reported;
  function report(){const mode=document.getElementById('pet').dataset.edgeIdle||'normal';if(mode!==reported){reported=mode;parent.postMessage({kind:'edge-demo-state',mode},'*')}}
  function animate(t){const delta=Math.max(0,Math.min(100,t-previous));previous=t;advance(delta);report();nativeFrame(animate)}
  nativeFrame(animate);
  window.demo=async kind=>{fixture.cursor({x:-1000,y:-1000});roll=kind==='crawl'?.25:.75;fixture.position(innerWidth/2-73);await fixture.step(45000)};
  window.addEventListener('message',e=>{if(e.source===parent&&(e.data==='crawl'||e.data==='rest'))void demo(e.data)});
  document.addEventListener('pointermove',e=>fixture.cursor({x:e.clientX,y:e.clientY}));
  document.addEventListener('pointerout',e=>{if(!e.relatedTarget)fixture.cursor({x:-1000,y:-1000})});
  fixture.position(innerWidth/2-73);
  `).replace(idle.setup, 'window.__nativeFrame=requestAnimationFrame.bind(window);window.__nativeNow=performance.now.bind(performance);\n'+idle.setup))
  writeFileSync('dist/edge-motion-preview.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>QQPet 贴边交互预览</title><style>
  body{font:15px system-ui,sans-serif;max-width:940px;margin:28px auto;padding:0 18px;color:#294454;background:#f6fafc}h1{font-size:24px}h2{font-size:18px;margin-bottom:8px}p{line-height:1.7}iframe{display:block;width:100%;height:300px;border:1px solid #b8cbd7;border-radius:8px;background:#edf5fa}button{padding:7px 18px;margin:0 8px 10px 0;border:1px solid #c29856;border-radius:6px;background:#fff1d7;color:#77471f;cursor:pointer}.bar{background:#dae3ea;padding:6px 15px;border-radius:0 0 7px 7px;color:#607787;font-size:12px}
  </style><body><h1>QQPet 贴边交互预览</h1><p>独立预览使用模拟数据，不读取宠物存档。头像与动作效果来自当前源码；完整宠物暂用头像代替 SWF。</p>
  <h2>斜着探头</h2><p>移到右侧小挂件看它探头；点击可展开，再拖到右缘松手收起。</p><iframe title="贴边探头预览" src="edge-mini-preview.html"></iframe>
  <h2>贴任务栏时的空闲动作</h2><p>点击按钮立即预览；鼠标移到宠物身上会立即停止。实际应用在空闲 20–45 秒后偶尔触发。</p>
  <button onclick="document.getElementById('idle').contentWindow.postMessage('crawl','*')">预览爬行</button><button onclick="document.getElementById('idle').contentWindow.postMessage('rest','*')">预览趴卧</button><span id="state"></span>
  <iframe id="idle" title="任务栏动作预览" src="edge-taskbar-preview.html"></iframe><div class="bar">任务栏位置示意</div>
  <script>addEventListener('message',e=>{if(e.source===document.getElementById('idle').contentWindow&&e.data?.kind==='edge-demo-state')document.getElementById('state').textContent={crawl:'正在爬行',rest:'正在趴卧',normal:'正常状态'}[e.data.mode]||''})</script></body></html>`)
  return resolve('dist/edge-motion-preview.html')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync('dist', { recursive: true })
  await prepareMini()
  await prepareEdgeIdle()
  console.log(writeEdgePreview())
}
