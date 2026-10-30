import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareEdgeIdle() {
  const setup = `
    window.info={lastX:200,lastY:414,sex:'GG',health:5,growth:0,yb:5000};
    window.save={havePet:true,isBury:false,settings:{hidden:false,paused:false}};
    window.phase='Kid'; window.working=false; window.miniMode=false; window.reserved=true;
    window.roll=.25; Math.random=()=>window.roll;
    window.time=0;window.timers=new Map();window.frames=new Map();window.writes=[];let id=1;
    performance.now=()=>window.time;
    window.setTimeout=(fn,delay)=>{const key=id++;timers.set(key,{fn,due:time+delay});return key};
    window.clearTimeout=key=>timers.delete(key);
    window.requestAnimationFrame=fn=>{const key=id++;frames.set(key,fn);return key};
    window.cancelAnimationFrame=key=>frames.delete(key);
    window.media={matches:false,addEventListener(_e,fn){this.changed=fn},removeEventListener(){this.changed=null}};
    window.matchMedia=()=>media;
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.testHidden?'hidden':'visible'});
    window.machine={pose:{a:'normal'}};
    window.qqpet={hasBottomTaskbar:async()=>reserved};
    window.advance=ms=>{
      time+=ms;
      for(const [key,timer] of [...timers])if(timer.due<=time){timers.delete(key);timer.fn()}
      const callbacks=[...frames.values()];frames.clear();for(const fn of callbacks)fn(time);
    };
  `
  const entry = `
    import {createEdgeIdle} from './edge-idle';
    import {petCanvasRect,axisMax,petMetrics} from '../pet/geometry';
    const pet=document.getElementById('pet');
    function layout(){const r=petCanvasRect();Object.assign(pet.style,{left:r.left+'px',top:r.top+'px',width:'146px',height:'146px'});window.dispatchEvent(new Event('qqpet:pet-layout'))}
    window.reflow=layout;layout();
    const controller=createEdgeIdle(pet,()=>miniMode);
    window.fixture={
      position(x=200,y=axisMax(innerHeight,146)){controller.interrupt();info.lastX=x;info.lastY=y;layout();controller.refresh()},
      async step(ms){await document.querySelector('.edge-idle-image').decode();advance(ms)},cursor:p=>controller.trackPointer(p),
      state(){const image=document.querySelector('.edge-idle-image'),r=image.getBoundingClientRect();return{active:controller.active,mode:pet.dataset.edgeIdle,timers:timers.size,frames:frames.size,model:structuredClone(info),writes:structuredClone(writes),translate:pet.style.translate,portrait:image.dataset.avatar,rootHidden:document.querySelector('.edge-idle')?.hidden,pet:JSON.parse(JSON.stringify(pet.getBoundingClientRect())),art:JSON.parse(JSON.stringify(document.querySelector('.edge-idle-art').getBoundingClientRect()))}},
      block(name,on){if(name==='busy')working=on;if(name==='paused')save.settings.paused=on;if(name==='hidden')save.settings.hidden=on;if(name==='sick')info.health=on?4:5;if(name==='dead')info.health=on?0:5;if(name==='mini')miniMode=on;if(name==='visibility')testHidden=on;if(name==='pose')machine.pose.a=on?'eat':'normal';controller.refresh()},
      panel(on){if(on){const e=document.createElement('div');e.className='boxFrame';document.body.append(e)}else document.querySelector('.boxFrame')?.remove()},
      reduced(on){media.matches=on;media.changed?.()},
      boundary(on){reserved=on;window.dispatchEvent(new Event('resize'))},
      avatar(sex,next){info.sex=sex;phase=next;layout()},
      refresh:()=>controller.refresh(),destroy:()=>controller.destroy(),
    };
  `
  const stub = `
    export const info=window.info,save=window.save,machine=window.machine;
    export const busy=()=>window.working,stage=()=>window.phase,mood=()=> 'peaceful',petSize=()=>146;
    export const setInfo=(key,value)=>{info[key]=value;writes.push({[key]:value});window.reflow()};
  `
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' }, bundle: true, write: false, format: 'iife',
    plugins: [{ name: 'isolated-edge-idle', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (['./edge-idle','../pet/geometry','../pet/portrait','../../shared/pet-geometry','./dom'].includes(args.path)) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const css = ['base.css','style.css','ui/css/edge-idle.css'].map(p => readFileSync('src/renderer/' + p, 'utf8')).join('\n')
  writeFileSync('dist/ui-edge-idle-prepared.json', JSON.stringify({ setup, code: result.outputFiles[0].text, css }))
}
