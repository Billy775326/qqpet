import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function learning(progress = 0, lineIndex = 0) {
  const state = {
    lineIndex,
    save: { petInfo: { health: 5, mood: 500 }, settings: { paused: false }, studyInfo: { chinese: progress, mathematics: 0, politics: 0, music: 0, art: 0, manner: 0, pe: 0, labouring: 0, wushu: 0 } },
    active: {} as Record<string, string>,
    messages: [] as { line: { s: string; b?: string; ai?: false }; hooks: { ok?: () => void } }[],
    tasks: [] as { task: { minutes: number; end: (early: boolean) => void }; id: string }[],
    exams: [] as { id: string; pass: () => void }[],
  }
  const stub = `
    const state=globalThis.state;
    export const save=state.save,info=save.petInfo,activity=key=>state.active[key];
    export const update=(group,patch)=>Object.assign(save[group],patch),setInfo=(key,value)=>info[key]=value;
    export const speak=(line,_action,hooks={})=>{state.messages.push({line,hooks});hooks.start?.()};
    export const startTask=(task,id)=>{state.tasks.push({task,id});state.active[task.key]=id};
    export const openExam=(id,pass)=>state.exams.push({id,pass});
    export const openEmail=()=>{},floatMood=()=>{},windowView=()=>{},tripBack=()=>{},isBuddy=()=>false,takePhoto=()=>null;
    export const addGood=()=>{},apply=()=>{},loot=()=>[],mailPhoto=()=>{},rand=(min,max)=>min===0&&max===2?state.lineIndex:min,addInfo=()=>{},luck=()=>0,addCount=()=>{};
  `
  const result = await build({ entryPoints: ['src/renderer/pet/jobs.ts'], bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-study', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || ['./rarity','./data/rarity','../pet/data/rarity'].includes(args.path) || args.path === './data/goods' || args.path.endsWith('.json')) return
      return { path: args.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
  } }] })
  const module = { exports: {} as any }
  runInNewContext(result.outputFiles[0].text, { state, module, exports: module.exports })
  return { state, api: module.exports }
}

test('random study lines keep the original single-bubble interaction and start one lesson', async () => {
  for (const [progress, minutes, total] of [[0, 45, 9], [10, 45, 20], [31, 55, 40], [72, 55, 95]] as const) for (const index of [0, 1, 2]) {
    const { state, api } = await learning(progress, index)
    assert.equal(api.study(api.studyGoods()[0]), true)
    const first = state.messages[0]
    assert.equal(state.messages.length, 1)
    assert.equal(first.line.b, undefined, 'normal study retains the original default button')
    assert.equal(first.hooks.ok, undefined, 'study chat has no help navigation callback')
    assert.equal(first.line.ai, undefined, 'existing chat processing is preserved')
    if (index === 0) assert.match(first.line.s, /被分配到.*班学习/)
    if (index === 1) assert.ok(first.line.s.includes(`${minutes}分钟`))
    if (index === 2) assert.ok(first.line.s.includes(`${total}课`))
    assert.equal(state.tasks.length, 1)
    assert.equal(state.tasks[0].task.minutes, minutes)
    assert.equal(state.active.study, state.tasks[0].id)
    assert.equal(state.save.studyInfo.chinese, progress)
  }
})

test('lesson completion explains the exam and awards the diploma only after passing', async () => {
  const { state, api } = await learning(8)
  assert.ok(api.describeStudy(api.studyGoods()[0]).includes('已学课时：8'))
  api.study(api.studyGoods()[0])
  state.tasks[0].task.end(false)
  assert.equal(state.save.studyInfo.chinese, 9)
  assert.ok(api.describeStudy(api.studyGoods()[0]).includes('已学课时：9（准备考试）'))
  const prompt = state.messages.at(-1)!
  assert.equal(prompt.line.b, '我要考试')
  assert.match(prompt.line.s, /3题全对.*这科的学历/)
  prompt.hooks.ok!()
  assert.equal(state.exams[0].id, 'xx-chinese')
  assert.equal(state.save.studyInfo.chinese, 9, 'opening an exam does not award the diploma')
  state.exams[0].pass()
  assert.equal(state.save.studyInfo.chinese, 10)
  assert.equal(api.diploma('chinese', 10), '小学语文')
  assert.equal(api.studyGoods()[0].id, 'zx-chinese')
  assert.ok(api.describeStudy(api.studyGoods()[0]).includes('已学课时：0'))
  assert.match(state.messages.at(-1)!.line.s, /档案.*这科的学历/)
})

test('completed stages reopen the exam and continuing study never promises a higher diploma', async () => {
  for (const [progress, lessons] of [[9, 9], [30, 20], [71, 40], [167, 95]]) {
    const exam = await learning(progress)
    const course = exam.api.studyGoods()[0]
    assert.ok(exam.api.describeStudy(course).includes(`已学课时：${lessons}（准备考试）`))
    assert.equal(exam.api.study(course), false)
    assert.equal(exam.state.tasks.length, 0)
    assert.equal(exam.state.messages[0].line.b, '我要考试')
    assert.equal(exam.api.describeStudy(course).filter((line: string) => line.includes('准备考试')).length, 1)
  }
  const continuing = await learning(168, 2)
  assert.equal(continuing.api.study(continuing.api.studyGoods()[0]), true)
  assert.match(continuing.state.messages[0].line.s, /研究生.*最高学历/)
  assert.equal(continuing.state.messages[0].hooks.ok, undefined)
  assert.ok(continuing.api.describeStudy(continuing.api.studyGoods()[0]).includes('已学课时：0'))
})
