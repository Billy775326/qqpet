import { description, version } from '../../../package.json'
import { speak } from '../pet/pet'
import { info, save, setInfo, update } from '../pet/store'
import { weatherNow } from '../pet/weather'
import { openFrame } from './box'
import './css/setup.css'
import { button, div, typeable } from './dom'
import { expandEdgeMini } from './edge-mini'
import { setFaceClick } from './face'
import { readopt, setHidden } from './menu'

type Option = { label: string; title?: string; hint?: string; group?: string; danger?: boolean; disabled?: () => boolean } & (
  | { type: 'radio'; on: () => boolean; run: () => void }
  | { type: 'slider'; value: () => number; step: (d: number) => void }
  | { type: 'button'; run: () => void }
  | { type: 'see'; value: string }
  | { type: 'input'; value: () => string; set: (v: string) => void }
)

function setOpacity(v: number): void {
  const o = Math.round(Math.min(Math.max(v, 0), 1) * 10) / 10
  update('settings', { opacity: o })
  document.body.style.setProperty('--opacity', String(o))
}
document.body.style.setProperty('--opacity', String(save.settings.opacity))

/** High-resolution assets; open windows keep their frames until reopened. */
function setHd(on: boolean): void {
  update('settings', { hd: on })
  document.body.classList.toggle('hd', on)
}
document.body.classList.toggle('hd', save.settings.hd)

/** Brings a lost pet back on screen. */
function homing(): void {
  expandEdgeMini()
  setInfo('lastX', 100)
  setInfo('lastY', innerHeight * 0.6)
  // On start: an interrupted hide ends, and hides the pet, right before.
  speak({ s: '[host],我在这里~', now: true }, 'appear', { start: () => setHidden(false) })
}

async function exportSave(): Promise<void> {
  if (await window.qqpet.exportSave()) speak({ s: '[host],存档导出成功啦~', now: true }, 'speak')
}

async function importSave(): Promise<void> {
  const message = '导入的存档会替换当前宠物（当前存档会备份为 save.json.bak），导入后自动重启，确定吗？'
  if ((await window.qqpet.messageBox({ type: 'question', title: '导入存档', message })) === 1) window.qqpet.importSave()
}

async function rebornAsOther(): Promise<void> {
  const message = '点击将会清空当前宠物数据，并重生为另一个性别的宠物，请慎重选择'
  if ((await window.qqpet.messageBox({ type: 'question', title: '重生为另一个性别~', message })) === 1) window.qqpet.resetPet(info.sex === 'GG' ? 'MM' : 'GG')
}

/** The pet reports the new city's weather right away, so a wrong name shows at once. */
function setCity(v: string): void {
  const city = v.trim()
  update('settings', { weatherCity: city })
  weatherNow().then(
    (t) => speak({ s: t, now: true }, 'speak'),
    () => speak({ s: `[host]，查不到「${city || '当前位置'}」的天气，换个写法试试吧~`, now: true }, 'speak'),
  )
}

/** The AI tab's model list and last result; `redraw` repaints the open panel once a request finishes. */
let models: string[] = []
let aiStatus = ''
let aiBusy = false
let aiRequest = 0
let keyStorage = await window.qqpet.keyStorage()
let redraw = (): void => {}

const reason = (e: unknown): string => String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

async function loadModels(): Promise<void> {
  if (aiBusy) return
  const request = ++aiRequest
  const config = { url: s.aiUrl, key: s.aiKey }
  aiBusy = true
  aiStatus = '正在获取模型列表…'
  redraw()
  try {
    const result = await window.qqpet.aiModels(config)
    if (request !== aiRequest) return
    models = result
    aiStatus = models.length ? '选择一个模型，选中后会自动测试，通过才会启用' : '接口没有返回任何模型'
  } catch (e) {
    if (request !== aiRequest) return
    models = []
    aiStatus = `获取失败：${reason(e)}`
  }
  if (request !== aiRequest) return
  aiBusy = false
  redraw()
}

/** A model is saved, and AI turned on, only if it answers. */
async function testModel(model: string): Promise<void> {
  if (aiBusy) return
  const request = ++aiRequest
  const config = { url: s.aiUrl, key: s.aiKey, model }
  aiBusy = true
  update('settings', { aiModel: '' })
  aiStatus = `正在测试 ${model}…`
  redraw()
  try {
    const reply = await window.qqpet.aiChat(config, [{ role: 'user', content: '你好，用一句话打个招呼。' }])
    if (request !== aiRequest) return
    update('settings', { aiModel: model })
    aiStatus = `测试通过，已启用。回复：${reply.slice(0, 60)}`
  } catch (e) {
    if (request !== aiRequest) return
    aiStatus = `测试失败：${reason(e)}`
  }
  if (request !== aiRequest) return
  aiBusy = false
  redraw()
}

/** Changing where to connect turns AI off until a model passes the test again. */
const setAi = (patch: { aiUrl?: string; aiKey?: string }): void => {
  aiRequest++
  aiBusy = false
  const changedUrl = patch.aiUrl !== undefined && patch.aiUrl !== s.aiUrl
  update('settings', { ...patch, ...(changedUrl ? { aiKey: '' } : {}), aiModel: '' })
  void window.qqpet.keyStorage().then(status => { keyStorage = status; redraw() })
  models = []
  aiStatus = ''
}

const aiOptions = (): Option[] => [
  { type: 'input', group: '连接设置', label: '接口地址', hint: '使用 OpenAI 兼容接口，通常以 /v1 结尾。更换地址会清除密钥。', value: () => s.aiUrl, set: (v) => setAi({ aiUrl: v.trim() }) },
  { type: 'input', group: '连接设置', label: 'API Key', value: () => s.aiKey, set: (v) => setAi({ aiKey: v.trim() }) },
  { type: 'see', group: '连接设置', label: '密钥保存', value: keyStorage },
  { type: 'button', group: '连接设置', label: '清除已保存密钥', run: () => setAi({ aiKey: '' }) },
  { type: 'button', group: '模型选择', label: aiBusy ? '正在连接…' : '获取模型列表', disabled: () => aiBusy, hint: '选择模型后会自动测试，通过才启用。', run: () => void loadModels() },
  ...models.map((m): Option => ({ type: 'radio', group: '模型选择', label: m, disabled: () => aiBusy, on: () => s.aiModel === m, run: () => void testModel(m) })),
  { type: 'see', group: '模型选择', label: '连接状态', value: aiStatus || (s.aiModel ? `已启用：${s.aiModel}` : '未启用') },
  ...(s.aiModel ? [{ type: 'button' as const, group: '模型选择', label: '关闭 AI', run: () => setAi({}) }] : []),
]

const FACE_TIP = '使用互动动作：鼠标放入宠物范围1s后（手机上点一下宠物），开启点位可进行点击~'
const s = save.settings

const TABS: { label: string; options: Option[] }[] = [
  {
    label: '全局设置',
    options: [
      { type: 'button', group: '宠物位置', label: '召回宠物', hint: '宠物不见了或移到屏幕外时，将它带回可见区域。', run: homing },
      { type: 'slider', group: '显示与互动', label: '透明度', value: () => s.opacity, step: (d) => setOpacity(s.opacity + d) },

      { type: 'input', group: '天气', label: '天气城市', hint: '留空时按网络位置自动定位，修改后播报天气。', value: () => s.weatherCity, set: setCity },
      {
        type: 'radio',
        group: '显示与互动',
        label: '互动动作',
        hint: '点击宠物的互动点位触发动作；这些点位不用于拖动。',
        title: FACE_TIP,
        on: () => s.faceClick > 0,
        run: () => setFaceClick(s.faceClick ? 0 : 1),
      },
      { type: 'radio', group: '显示与互动', label: '显示互动点位', hint: '在宠物身上标出可以点击的位置。', on: () => s.faceClick === 2, run: () => setFaceClick(s.faceClick === 2 ? 1 : 2) },
      { type: 'radio', group: '显示与互动', label: '免打扰模式', hint: '关闭宠物的聊天气泡。', on: () => s.quiet, run: () => update('settings', { quiet: !s.quiet }) },
      { type: 'radio', group: '显示与互动', label: '高清画质', hint: '新打开的窗口边框生效；高清界面素材重启后生效。', on: () => s.hd, run: () => setHd(!s.hd) },
    ],
  },
  {
    label: '存档',
    options: [
      { type: 'button', group: '备份与恢复', label: '导出存档', hint: '保存为文件，用于备份或换电脑。', run: exportSave },
      { type: 'button', group: '备份与恢复', label: '导入存档', hint: '支持原版 config.json；替换前备份当前存档，导入后重启。', run: importSave },
      { type: 'button', group: '重新开始', danger: true, label: '重新领养', hint: '清空当前宠物，返回领养界面。操作前会再次确认。', run: readopt },
      { type: 'button', group: '重新开始', danger: true, label: '更换性别并重生', hint: '清空当前宠物，重生为另一个性别。操作前会再次确认。', run: rebornAsOther },
    ],
  },
  {
    label: '工具',
    options: [
      { type: 'radio', group: '剪贴板', label: '播报复制的文字', hint: '开启后监听剪贴板，由宠物朗读复制的内容。', on: () => s.clip, run: () => update('settings', { clip: !s.clip }) },
    ],
  },
  {
    label: 'AI',
    get options() {
      return aiOptions()
    },
  },
  {
    label: '关于',
    options: [
      { type: 'see', label: '软件', value: `QQPet v${version}` },
      { type: 'see', label: '简介', value: description },
      { type: 'see', label: '作者', value: 'Ankio' },
      { type: 'see', label: '邮箱', value: 'ankio@ankio.net' },
      { type: 'see', label: '项目地址', value: 'https://github.com/AnkioTomas/qqpet' },
      { type: 'see', label: '声明', value: 'QQ 宠物相关素材版权归腾讯所有，本项目仅供学习交流，请勿用于商业用途' },
    ],
  },
]

function control(cls: string, label: string, run: () => void, disabled = false): HTMLElement {
  const activate = (): void => { if (!disabled) run() }
  const element = button(`${cls} focusPress${disabled ? ' disabled' : ''}`, activate)
  element.tabIndex = disabled ? -1 : 0
  element.setAttribute('role', 'button')
  element.setAttribute('aria-label', label)
  element.setAttribute('aria-disabled', String(disabled))
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate() }
  })
  return element
}

function option(o: Option, redraw: () => void): HTMLElement {
  const act = (f: () => void) => (): void => {
    f()
    redraw()
  }
  let inner: HTMLElement
  const hint = o.hint ?? o.title
  const label = div('optionCopy', div('label', o.label), ...(hint ? [div('optionHint', hint)] : []))
  if (o.type === 'radio') {
    inner = control('childrenIn radio', o.label, act(o.run), o.disabled?.())
    inner.setAttribute('role', o.group === '模型选择' ? 'radio' : 'checkbox')
    inner.setAttribute('aria-checked', String(o.on()))
    const mark = div(o.on() ? 'choose active' : 'choose')
    mark.setAttribute('aria-hidden', 'true')
    inner.append(mark, label)
  } else if (o.type === 'slider') {
    const value = div('sliderValue', `${Math.round(o.value() * 100)}%`)
    const range = typeable(Object.assign(document.createElement('input'), { type: 'range', className: 'opacityRange', min: '0', max: '1', step: '0.1', value: String(o.value()) }))
    range.setAttribute('aria-label', o.label)
    range.addEventListener('input', () => { value.textContent = `${Math.round(Number(range.value) * 100)}%` })
    range.addEventListener('change', act(() => o.step(Number(range.value) - o.value())))
    inner = div('childrenIn slider', div('sliderHeading', label, value), div('sliderLine',
      control('sl_down', '降低透明度', act(() => o.step(-0.1))), range,
      control('sl_up', '提高透明度', act(() => o.step(0.1))),
    ))
  } else if (o.type === 'button') {
    const action = control(`setupAction${o.danger ? ' danger' : ''}`, o.label, act(o.run), o.disabled?.())
    action.textContent = o.label
    inner = div('childrenIn actionRow', action, ...(hint ? [div('optionHint', hint)] : []))
  } else if (o.type === 'input') {
    const input = typeable(Object.assign(document.createElement('input'), { className: 'textInput', type: o.label.startsWith('API Key') ? 'password' : 'text', value: o.value() }))
    input.setAttribute('aria-label', o.label)
    input.autocomplete = 'off'
    input.spellcheck = false
    input.addEventListener(
      'change',
      act(() => o.set(input.value)),
    )
    inner = div('childrenIn inputRow', label, input)
  } else {
    inner = div('childrenIn infoRow', div('infoLabel', o.label), div('seeValue', o.value))
  }
  const row = div('childrens', inner)
  row.title = o.title ?? ''
  return row
}

let close = (): void => {}

export function openSetup(): void {
  close()
  let tab = 0
  const left = div('leftScroll fcC')
  const right = div('rightScroll')
  const title = div('right_title')
  let pointerDown = false
  let pendingDraw = false
  const pointerStart = (): void => { pointerDown = true }
  const pointerEnd = (): void => {
    pointerDown = false
    // A field may commit on blur during pointerdown. Keep the pressed button
    // alive until its click finishes, then repaint dependent settings.
    if (pendingDraw) setTimeout(() => { if (right.isConnected) draw() }, 0)
  }
  const draw = (): void => {
    if (pointerDown) { pendingDraw = true; return }
    pendingDraw = false
    const scroll = right.scrollTop
    const focused = document.activeElement instanceof HTMLElement && (right.contains(document.activeElement) || left.contains(document.activeElement))
      ? document.activeElement.getAttribute('aria-label') : null
    const pick = (i: number) => (): void => {
      if (tab === i) return
      tab = i
      right.scrollTop = 0
      draw()
    }
    left.replaceChildren(...TABS.map((t, i) => {
      const item = control(i === tab ? 'lm_once activeMenu' : 'lm_once', t.label, pick(i))
      item.textContent = t.label
      item.setAttribute('role', 'tab')
      item.setAttribute('aria-selected', String(i === tab))
      return item
    }))
    title.textContent = TABS[tab].label
    const groups = new Map<string, HTMLElement>()
    for (const o of TABS[tab].options) {
      const name = o.group ?? ''
      if (!groups.has(name)) groups.set(name, div('setupGroup', ...(name ? [div('groupTitle', name)] : [])))
      groups.get(name)!.append(option(o, draw))
    }
    right.replaceChildren(...groups.values(), div('setupFootnote', '设置会自动保存'))
    right.scrollTop = scroll
    if (focused) {
      const target = [...left.querySelectorAll<HTMLElement>('[aria-label]'), ...right.querySelectorAll<HTMLElement>('[aria-label]')]
        .find(element => element.getAttribute('aria-label') === focused && element.getAttribute('aria-disabled') !== 'true')
      target?.focus({ preventScroll: true })
    }
  }
  left.setAttribute('role', 'tablist')
  left.setAttribute('aria-label', '设置分类')
  right.setAttribute('role', 'tabpanel')
  draw()
  redraw = draw
  const dismiss = control('close', '关闭系统设置', () => close())
  const content = div('ui-setup', div('setUp', dismiss, left, title, right))
  content.addEventListener('pointerdown', pointerStart, true)
  document.addEventListener('pointerup', pointerEnd)
  document.addEventListener('pointercancel', pointerEnd)
  window.addEventListener('blur', pointerEnd)
  const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') close() }
  document.addEventListener('keydown', escape)
  const remove = openFrame(
    content,
    'pet/sysSeting/ditu.png',
  )
  content.closest('.boxFrame')!.classList.add('setupFrame')
  close = (): void => {
    const focused = document.activeElement
    if (focused instanceof HTMLInputElement && right.contains(focused)) focused.blur()
    document.removeEventListener('pointerup', pointerEnd)
    document.removeEventListener('pointercancel', pointerEnd)
    window.removeEventListener('blur', pointerEnd)
    document.removeEventListener('keydown', escape)
    redraw = () => {}
    remove()
    close = () => {}
  }
}
