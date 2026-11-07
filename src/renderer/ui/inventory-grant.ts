import { INVENTORY_GRANT_KEY, inventoryGrantGoods, mailInventoryGrant, readMails } from '../pet/mail'
import { windowView } from './window-view'

/** Use the existing alert skin and send attachments instead of mutating inventory. */
export function openInventoryGrant(): void {
  const pending = Object.values(readMails()).find(mail => !mail.e && !mail.r && mail.k === INVENTORY_GRANT_KEY)
  if (pending) {
    windowView({ title: '全物品领取', msg: '物品已发送至邮箱，尚未收取。\n请在邮箱中领取附件。' })
    return
  }
  const count = inventoryGrantGoods().length
  let finished = false
  let error = ''
  windowView({
    title: '全物品领取',
    cancel: true,
    msg: () => error || `食物、清洁用品、药品和玩具
共 ${count} 种，每种 1 份。
确认后寄至邮箱，请自行收取。`,
    ok: close => {
      if (finished) return
      try {
        mailInventoryGrant()
        finished = true
        close()
      } catch (cause) {
        console.error('Inventory grant mail failed:', cause)
        error = '保存失败，未发送物品邮件，请检查存档状态后重试。'
      }
    },
  })
}
