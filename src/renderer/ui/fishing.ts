import { pondCommand, pondState, pondStockQuote } from '../pet/fishing'
import { info, save } from '../pet/store'
import { SwfPlayer } from '../swf/player'
import { openFrame } from './box'
import './css/fishing.css'
import { div } from './dom'

const HEAD = { game: 6, key: '', svr: 0, ver: 1 }
/** The SWF's "harvest all" button only alerts this; the original answered it with a harvest-all request. */
const HARVEST_ALL = '暂不支持一键收获！'

let open = false

/** "1", a growth band and the sex: the original's grade code for the pet avatar in the pond. */
function grade(): string {
  const l = save.petComputedlInfo.level
  return `1${l < 5 ? 1 : l < 8 ? 2 : 0}${info.sex === 'GG' ? 2 : 3}`
}

export function openFishing(): void {
  if (open) return
  open = true
  const host = div('fishing')
  const player = new SwfPlayer(host)
  const remove = openFrame(div('ui-fishing', host))
  let closed = false
  let readyTimer: ReturnType<typeof setInterval> | undefined
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const queue: string[] = []
  const flush = (): void => {
    const receive = (player.el as unknown as Record<string, unknown>).PETEventOnReceived
    if (closed || typeof receive !== 'function') return
    clearInterval(readyTimer)
    readyTimer = undefined
    for (const json of queue.splice(0)) receive.call(player.el, json)
  }
  const send = (cmd: number, data: unknown): void => {
    if (closed) return
    queue.push(JSON.stringify({ data, head: { ...HEAD, cmd } }))
    // The Flash caller must unwind before a response enters its event handlers.
    queueMicrotask(() => {
      if (closed) return
      flush()
      if (queue.length && readyTimer === undefined) readyTimer = setInterval(flush, 50)
    })
  }
  const alert = window.alert
  const previousSend = window.PETSendData
  const previousPetInfo = window.SNS_GetSelfPetInfo
  const previousClose = window.close_game
  const previousQuote = window.QQPetPondStockQuote

  window.QQPetPondStockQuote = (fryid, paytype) => {
    const quote = pondStockQuote(fryid, paytype)
    return { max: closed ? 0 : quote.max, free: quote.free, price: quote.fry?.price_yb ?? 0, reason: quote.reason }
  }

  window.PETSendData = (json) => {
    const { head, data } = JSON.parse(json)
    if (head.cmd === 4) {
      // Quantity and payment confirmation belong to the original SWF shop.
      // Unwind the Flash caller before replying, including a failed atomic save.
      queueMicrotask(() => {
        if (closed) return
        try {
          const reply = pondCommand(4, data)
          send(4, reply)
          // The original stocking animation requests a fresh pond on completion.
          // Do not fold that separate refresh/save into the purchase result.
        } catch (cause) {
          console.error('Pond stocking failed:', cause)
          send(4, { result: 6, msg: '保存失败，元宝和鱼苗均未改变，请重试。' })
        }
      })
      return
    }
    const reply = pondCommand(head.cmd, data)
    send(head.cmd, reply)
    if (head.cmd === 8 && reply.result === 6) refreshTimer = setTimeout(() => send(1, pondState()), 100)
  }
  window.SNS_GetSelfPetInfo = () => ({
    petid: '1',
    qqnumber: '66666666',
    petName: info.name,
    masterName: info.host,
    level: save.petComputedlInfo.level,
    isvip: info.pinkDiamond ? 1 : 0,
    grade: grade(),
    gender: grade(),
    staus: 1,
    starve: info.hunger,
    starveMax: save.petComputedlInfo.hungerMax,
    clean: info.clean,
    cleanMax: save.petComputedlInfo.cleanMax,
    qqsign: '',
    viplevel: info.PDiamondLevel,
  })
  window.alert = (msg) => {
    if (msg === HARVEST_ALL) window.PETSendData(JSON.stringify({ data: {}, head: { ...HEAD, cmd: 8 } }))
  }
  window.close_game = (n) => {
    if (n !== 1 || closed) return
    closed = true
    clearInterval(readyTimer)
    clearTimeout(refreshTimer)
    queue.length = 0
    player.destroy()
    remove()
    window.alert = alert
    window.PETSendData = previousSend
    window.SNS_GetSelfPetInfo = previousPetInfo
    window.close_game = previousClose
    window.QQPetPondStockQuote = previousQuote
    open = false
  }

  void player.load('pet/fishing/main.swf').catch(error => {
    console.error('Pond movie failed to load:', error)
    if (!closed) window.close_game(1)
  })
  send(1, pondState())
}
