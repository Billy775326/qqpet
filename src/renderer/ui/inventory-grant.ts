import { INVENTORY_GRANT_KEY, inventoryGrantGoods, mailInventoryGrant, readMails } from '../pet/mail'
import { windowView } from './window-view'

/** Use the existing alert skin and send attachments instead of mutating inventory. */
export function openInventoryGrant(): void {
  const pending = Object.values(readMails()).find(mail => !mail.e && !mail.r && mail.k === INVENTORY_GRANT_KEY)
  if (pending) {
    windowView({ title: '全物品领取', msg: '邮箱中已有一封待领取的物品邮件，请自行打开邮箱收取附件。' })
    return
  }
  const count = inventoryGrantGoods().length
  let finished = false
  let error = ''
  windowView({
    title: '全物品领取',
    msg: () => error || `食物、清洁用品、药品、玩具，每种 1 份，共 ${count} 种。确认后发送至邮箱，收取附件时加入背包。`,
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
