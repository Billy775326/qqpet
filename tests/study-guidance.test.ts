import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'

async function learning(progress = 0) {
  const state = {
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
    export const addGood=()=>{},apply=()=>{},loot=()=>[],mailPhoto=()=>{},rand=()=>0,addInfo=()=>{},luck=()=>0,addCount=()=>{};
  `
  const result = await build({ entryPoints: ['src/renderer/pet/jobs.ts'], bundle: true, write: false, format: 'cjs', plugins: [{ name: 'isolated-study', setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || args.path === './data/goods' || args.path.endsWith('.json')) return
      return { path: args.path, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub }))
  } }] })
  const module = { exports: {} as any }
  runInNewContext(result.outputFiles[0].text, { state, module, exports: module.exports })
  return { state, api: module.exports }
}

test('study chat explains the current stage without interrupting lessons or rewriting rules', async () => {
  for (const [progress, name, minutes, total] of [[0, '小学语文', 45, 9], [10, '中学语文', 45, 20], [31, '大学语文', 55, 40], [72, '研究生语文', 55, 95]] as const) {
    const { state, api } = await learning(progress)
    assert.equal(api.study(api.studyGoods()[0]), true)
    const first = state.messages[0]
    assert.ok(first.line.s.includes(name) && first.line.s.includes(`${minutes}分钟`) && first.line.s.includes(`0/${total}课`))
    assert.equal(first.line.b, '学历说明')
    first.hooks.ok!()
    assert.match(state.messages.at(-1)!.line.s, /按科目.*九科.*3题全对.*重考.*档案/)
    state.messages.at(-1)!.hooks.ok!()
    assert.match(state.messages.at(-1)!.line.s, /没有等级、粉钻或元宝门槛.*健康.*心情大于0.*暂停成长.*打工、学习或旅游/)
    assert.ok(state.messages.every(message => message.line.ai === false))
    assert.equal(state.tasks.length, 1)
    assert.equal(state.tasks[0].task.minutes, minutes)
    assert.equal(state.active.study, state.tasks[0].id)
    assert.equal(state.save.studyInfo.chinese, progress, 'reading help cannot award lessons')
  }
})

test('lesson completion explains the exam and awards the diploma only after passing', async () => {
  const { state, api } = await learning(8)
  api.study(api.studyGoods()[0])
  state.tasks[0].task.end(false)
  assert.equal(state.save.studyInfo.chinese, 9)
  const prompt = state.messages.at(-1)!
  assert.equal(prompt.line.b, '我要考试')
  assert.match(prompt.line.s, /随机3题全对.*小学语文.*重考/)
  assert.equal(prompt.line.ai, false)
  prompt.hooks.ok!()
  assert.equal(state.exams[0].id, 'xx-chinese')
  assert.equal(state.save.studyInfo.chinese, 9, 'opening an exam does not award the diploma')
  state.exams[0].pass()
  assert.equal(state.save.studyInfo.chinese, 10)
  assert.equal(api.diploma('chinese', 10), '小学语文')
  assert.match(state.messages.at(-1)!.line.s, /小学语文.*档案.*学历获得/)
})

test('completed stages reopen the exam and continuing study never promises a higher diploma', async () => {
  const exam = await learning(9)
  assert.equal(exam.api.study(exam.api.studyGoods()[0]), false)
  assert.equal(exam.state.tasks.length, 0)
  assert.equal(exam.state.messages[0].line.b, '我要考试')
  const continuing = await learning(168)
  assert.equal(continuing.api.study(continuing.api.studyGoods()[0]), true)
  assert.match(continuing.state.messages[0].line.s, /已取得这科研究生学历.*提升属性/)
  continuing.state.messages[0].hooks.ok!()
  assert.match(continuing.state.messages.at(-1)!.line.s, /学无止境.*不再增加学历/)
})
