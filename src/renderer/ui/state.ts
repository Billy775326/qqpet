import { sweetHeartCapacity } from '../../shared/sweetheart'
import { elapsed, stopTask } from '../pet/activity'
import { durationText, goodOf, type TimedType } from '../pet/data/goods'
import { speak } from '../pet/pet'
import { activity, growthPerMinute, info, onInfoChange, save, setInfo } from '../pet/store'
import { openSweetHeartPurchase } from './sweetheart'
import { openGoods } from './control'
import './css/state.css'
import { button, div, img } from './dom'
import { frame } from './frame'
import { openPetInfo } from './petinfo'
import { progress } from './progress'
import { windowView } from './window-view'

const WIDTH = 190
const BUSY = [
  { key: 'work', name: '工作中', stop: 'stopWork' },
  { key: 'study', name: '学习中', stop: 'stopStudy' },
  { key: 'trip', name: '旅游中', stop: 'overTripUp' },
] as const

let panel: HTMLElement | null = null
/** Bars show their numbers always instead of on hover; toggled by clicking the growth bar. */
let showNums = false

/** Level badges: one per 5 levels written in binary (128s down to 2s), then one or two plain bones. */
function bones(level: number): string[] {
  let n = (level / 5) | 0
  const out: string[] = []
  for (let unit = 128, i = 7; unit >= 2; unit /= 2, i--) for (; n >= unit; n -= unit) out.push(`dengji${i}`)
  return [...out, ...Array<string>(n + 1).fill('dengji')]
}

export function age(minutes: number): string {
  const h = minutes > 59 ? (minutes / 60) | 0 : 0
  const m = minutes - h * 60
  return (h ? `${h}小时` : '') + (m || !h ? `${m}分钟` : '')
}

function stop(): void {
  const k = stopTask()
  const b = BUSY.find((x) => x.key === k)
  if (b) speak({ c: 'state', s: b.stop, now: true }, 'speak')
  render()
}

/** What the pet is doing; busy states come with a stop button. */
export function status(): (Node | string)[] {
  if (save.settings.paused) return ['暂停成长']
  if (info.health === 0) return ['已死亡']
  if (activity('ill')) return ['生病了']
  const b = BUSY.find((x) => activity(x.key))
  if (!b) return ['正在成长']
  return [`${b.name} `, div('fc', ` (${elapsed() | 0}分钟) `, button('stopDoActive butDo', stop, ' 停止 '))]
}

/** Buying sweetheart days, or switching a booked one on and off. */
function sweetHeart(): void {
  if (!sweetHeartCapacity(info.sweetHeartOverTime).remainingDays) return openSweetHeartPurchase()
  const on = !info.sweetHeart
  windowView({
    title: '贴心宝贝',
    msg: on ? '当前贴心宝贝已开启，开启自动喂食以及贴心宝贝效果，是否继续？~~' : '关闭后只是关闭自动喂养功能，是否继续？~~',
    sweet: true,
    ok: (close) => {
      speak({ s: on ? '[host],开启了贴心宝贝，我真是太爱你了！~' : '[host],我依然还是爱你的，天地可鉴！~', now: true }, 'speak')
      setInfo('sweetHeart', on)
      close()
    },
  })
}

const row = (label: string, ...value: (Node | string)[]): HTMLElement => div('onceInfo fc', div('label', label), ...value)

function bar(label: string, n: number, m: number, onClick: () => void, text?: string): HTMLElement {
  const r = row(label, div('valueLine f1', progress(n, m, { graded: !text, hover: !showNums, text })))
  r.addEventListener('click', onClick)
  return r
}

function render(): void {
  if (!panel) return
  const c = save.petComputedlInfo
  const diamond = div('pinkDiamond')
  diamond.style.backgroundImage = `url(pet/info/${info.pinkDiamond ? 'u' : 'n'}${info.PDiamondLevel || 1}.svg)`
  const timed = Object.entries(save.selfGoodUseOption).flatMap(([type, t]) => {
    if (!t) return []
    const g = goodOf(type as TimedType, t.id)
    const duration = type === 'background' ? durationText(g, t.left) : ''
    const title = type === 'background' ? `${g.name}${duration ? `：剩余${duration}` : ''}` : `${g.name}：${g.group}*${t.left | 0}分钟`
    return [Object.assign(img('groupIcons', g.url), { title })]
  })
  const heart = div('sweetHeart')
  const { remainingDays, availableDays } = sweetHeartCapacity(info.sweetHeartOverTime)
  heart.title = remainingDays ? `剩余约${remainingDays}天，点击续费（最多${availableDays}天）` : '点击开通贴心宝贝'
  heart.addEventListener('click', openSweetHeartPurchase)
  heart.style.backgroundImage = `url(pet/stateInfo/${info.sweetHeart ? 'h_up' : 'h_down'}.png)`
  const toggleNums = (): void => {
    showNums = !showNums
    render()
  }

  const content = div(
    '',
    div('head fcb', button('openPetInfo', openPetInfo), div('pinkDiamondMain f1', diamond), button('close', closeState)),
    div(
      'infos px8',
      row('昵称：', div('value wsnw', info.name)),
      row(
        '等级：',
        div('value', String(c.level)),
        div('bones fcc ml4', ...bones(c.level).map((b) => div('bone fcc', img('boneImg', `pet/stateInfo/${b}.png`)))),
      ),
      row('年龄：', div('value', age(info.onLineTime | 0))),
      bar('成长：', info.growth - c.upGrowth, c.nextGrowth - c.upGrowth, toggleNums, `${Math.round(info.growth)} / ${c.nextGrowth}`),
      bar('饥饿：', info.hunger, c.hungerMax, () => openGoods('food')),
      bar('清洁：', info.clean, c.cleanMax, () => openGoods('clean')),
      bar('健康：', info.health, 5, () => openGoods('medicine')),
      bar('心情：', info.mood, 1000, () => openGoods('toy')),
      row('成长速度：', div('value', `${Math.round(growthPerMinute() * 60)}/小时`), div('icons fcw', ...timed)),
      row('状态：', div('value fc', ...status())),
      row('在线时间：', div('value', `${info.onlineDataTime | 0}分钟`)),
    ),
    div('foot fcb w100', heart, button(info.sweetHeart ? 'closeSweetHeart' : 'openSweetHeart', sweetHeart)),
  )
  panel.replaceChildren(frame(content, (n) => `pet/stateInfo/ditu0${n}.png`, [32, 32]))
}

export function closeState(): void {
  panel?.parentElement!.remove()
  panel = null
}

/** Opens the status panel from tray point (x, y), toward the screen's middle. */
export function openState(x: number, y: number): void {
  closeState()
  panel = div('PetStateInfo focusPress')
  panel.dataset.hit = ''
  panel.style.width = `${WIDTH}px`
  panel.style.left = `${Math.min(Math.max(x - WIDTH / 2, 0), innerWidth - WIDTH)}px`
  if (y < innerHeight / 2) panel.style.top = `${Math.max(y, 0)}px`
  else panel.style.bottom = `${Math.max(innerHeight - y, 0)}px`
  document.body.appendChild(div('ui-state', panel))
  render()
}

let queued = 0
onInfoChange(() => {
  if (panel && !queued)
    queued = requestAnimationFrame(() => {
      queued = 0
      render()
    })
})
