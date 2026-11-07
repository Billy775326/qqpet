import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

export async function prepareTasks() {
  const entry = `
    import {openTask} from './task';
    import {save,info} from '../pet/store';
    import {addCount,resetTasks,resetTour} from '../pet/tasks';
    const timers=new Set(),nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
    window.setInterval=(fn,...args)=>{const id=nativeSetInterval(fn,...args);timers.add(id);return id};
    window.clearInterval=id=>{timers.delete(id);nativeClearInterval(id)};
    window.fixtureResults=[];
    window.fixture={open:openTask,save,addCount,resetTasks,resetTour,timerCount:()=>timers.size};
  `
  const allowed = ['./task', './result', './reward-icon', '../pet/tasks', './tasks', './milestones', '../pet/store', './store', './box', './dom', '../ui/dom', './level', './data/goods', '../pet/data/goods', './items', './goods', './inventory', './vip', '../../shared/sweetheart']
  const stub = `export const speak=()=>{},floatMood=()=>{},resetFish=()=>{},loot=()=>[],rand=min=>min;
    export const DEAD={cure:{id:'0'}},illOf=()=>({cure:{id:'0'}}),windowView=()=>{};
    export const showResult=(_root,goods)=>window.fixtureResults.push(goods);`
  const result = await build({
    stdin: { contents: entry, resolveDir: resolve('src/renderer/ui'), loader: 'ts' }, bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'isolated-tasks-ui', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (!args.importer || allowed.includes(args.path) || args.path.endsWith('.json')) return
        return { path: args.path, namespace: 'mock' }
      })
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: stub }))
    } }],
  })
  const css = ['base.css', 'style.css', 'ui/css/task.css', 'ui/css/result.css'].map(p => readFileSync('src/renderer/' + p, 'utf8')).join('\n')
  writeFileSync('dist/ui-tasks-prepared.json', JSON.stringify({ code: result.outputFiles[0].text, css }))
}
