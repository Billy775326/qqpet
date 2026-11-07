import type { CalendarDay } from '../../shared/ipc'
import { isBuddy, type Shot } from './album'
import { allGoods, goodOf, type Good } from './data/goods'
import { goodsCommitted } from './goods'
import { inventoryPatch } from './inventory'
import { rand } from './rand'
import { commit, info, save } from './store'

/** saveJsonData.email entries, keyed by `d` (unix seconds); a deleted mail keeps only its keys. */
export interface Live {
  d: number
  /** Title. */
  l: string
  glb: Good[]
  /** Claimed. */
  r?: boolean
  /** What the pet says on claiming. */
  m?: string
  /** Mails generated here are sent once per key. */
  k?: string
  /** A travel photo, by album id. */
  p?: string
  e?: undefined
}
export type Mail = Live | { d: number; e: true; k?: string }

const listeners = new Set<() => void>()
export function onMailChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const changed = (): void => listeners.forEach(listener => listener())

export const readMails = (): Record<string, Mail> => JSON.parse(save.saveJsonData.email || '{}')
export const writeMails = (mails: Record<string, Mail>): void => {
  commit({ saveJsonData: { email: JSON.stringify(mails) } })
  changed()
}

export const INVENTORY_GRANT_KEY = 'inventory-grant-v1'
export const INVENTORY_GRANT_TYPES = ['food', 'clean', 'medicine', 'toy'] as const
/** Freeze the current registered catalogue into ordinary, compatible mail attachments. */
export const inventoryGrantGoods = (): Good[] => INVENTORY_GRANT_TYPES.flatMap(type => allGoods(type))

/** At most one unclaimed grant mail; retrying or double-clicking never queues duplicates. */
export function mailInventoryGrant(): { created: boolean; count: number } {
  const mails = readMails()
  const pending = Object.values(mails).find((m): m is Live => !m.e && !m.r && m.k === INVENTORY_GRANT_KEY)
  if (pending) return { created: false, count: pending.glb.length }
  const glb = inventoryGrantGoods()
  const d = slot(mails)
  mails[d] = { d, k: INVENTORY_GRANT_KEY, l: '全物品领取', m: '[host]，全物品邮件的附件已经收进背包啦~', glb }
  writeMails(mails)
  return { created: true, count: glb.length }
}

/** Attachments, seen IDs and claim state reach disk together, or all remain unchanged. */
export function claimMails(ids: readonly string[]): Live[] {
  const mails = readMails()
  const claimed: Live[] = []
  for (const id of new Set(ids)) {
    const mail = Object.hasOwn(mails, id) ? mails[id] : undefined
    if (!mail || mail.e || mail.r) continue
    mail.r = true
    claimed.push(mail)
  }
  if (!claimed.length) return []
  const goods = claimed.flatMap(mail => mail.glb)
  commit({ ...inventoryPatch(save, goods), saveJsonData: { email: JSON.stringify(mails) } })
  goodsCommitted(goods.map(g => g.type))
  changed()
  return claimed
}

/** Delete only already-claimed mail, retaining its original deduplication key. */
export function deleteMails(ids: readonly string[]): void {
  const mails = readMails()
  let removed = false
  for (const id of new Set(ids)) {
    const mail = Object.hasOwn(mails, id) ? mails[id] : undefined
    if (!mail || mail.e || !mail.r) continue
    mails[id] = { d: mail.d, e: true, k: mail.k }
    removed = true
  }
  if (removed) writeMails(mails)
}

/** n different goods of a type, 1-3 of each. */
function some(type: 'food' | 'toy', n: number): Good[] {
  const all = allGoods(type)
  return Array.from({ length: n }, () => ({ ...all.splice(rand(0, all.length - 1), 1)[0], num: rand(1, 3) }))
}

/** A free key from now on; mails are keyed by their time. */
function slot(mails: Record<string, Mail>): number {
  let d = Math.floor(Date.now() / 1000)
  while (mails[d]) d++
  return d
}

/** Random food and toys plus `yb` 元宝, unless a mail with key `k` was ever sent. */
function send(mails: Record<string, Mail>, k: string, l: string, yb: number, m: string): boolean {
  if (Object.values(mails).some((x) => x.k === k)) return false
  const d = slot(mails)
  mails[d] = { d, k, l, m, glb: [...some('food', 3), ...some('toy', 2), goodOf('nums', 'yb', yb)] }
  return true
}

/** The photo from a trip, as a mail without goods. */
export function mailPhoto(s: Shot): void {
  const mails = readMails()
  const d = slot(mails)
  const l = isBuddy(s.id) ? `在${s.city}遇到了旅游搭子！` : `来自${s.city}的明信片`
  mails[d] = { d, l, p: s.id, m: '[host]，照片我收进「旅游-相簿」啦，随时可以翻看哦~', glb: [] }
  writeMails(mails)
}

/** Welcome, birthday and holiday mails due today; true when any arrived. */
export function deliverMails(today?: CalendarDay): boolean {
  const mails = readMails()
  const now = new Date()
  const born = new Date(info.birthDay * 1000)
  const years = now.getFullYear() - born.getFullYear()
  const due: [k: string, l: string, yb: number, m: string][] = []
  if (!Object.values(mails).some((m) => !m.e)) due.push(['welcome', '欢迎来到QQ宠物~', 100, '[host]，欢迎回家！右键（手机上长按）我或者点我脚下的标签，有好多好玩的哦~'])
  if (years > 0 && now.getMonth() === born.getMonth() && now.getDate() === born.getDate())
    due.push([`birthday-${now.getFullYear()}`, `${info.name}的${years}周岁生日快乐！`, 300, '[host]，今天是我的生日，谢谢你一直陪着我！'])
  const h = today?.holiday
  if (h?.off) due.push([`${now.getFullYear()}-${h.name}`, `${h.name}快乐！`, 200, `[host]，${h.name}快乐！收到节日礼物啦~`])
  const sent = due.filter((m) => send(mails, ...m)).length > 0
  if (sent) writeMails(mails)
  return sent
}
