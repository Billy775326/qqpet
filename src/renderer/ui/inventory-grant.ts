import { inventoryGrantGoods, mailInventoryGrant } from '../pet/mail'
import { openEmail } from './email'
import { windowView } from './window-view'

/** Use the existing alert skin and send attachments instead of mutating inventory. */
export function openInventoryGrant(): void {
  const count = inventoryGrantGoods().length
  let finished = false
  let error = ''
  windowView({
    title: '全物品领取',
    msg: () => error || `将食物、清洁用品、药品、玩具各 1 份，共 ${count} 种，发送到邮箱。领取附件后加入背包，已有数量保留。`,
    ok: close => {
      if (finished) return
      try {
        const result = mailInventoryGrant()
        finished = true
        close()
        windowView({
          title: '全物品领取',
          msg: `${result.created ? '已发送' : '邮箱已有一封待领取的'}全物品邮件，包含 ${result.count} 种物品。点击确认打开邮箱领取附件。`,
          ok: dismiss => { dismiss(); openEmail() },
        })
      } catch (cause) {
        console.error('Inventory grant mail failed:', cause)
        error = '保存失败，未发送物品邮件，请检查存档状态后重试。'
      }
    },
  })
}
