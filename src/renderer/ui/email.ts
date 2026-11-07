import { speak } from '../pet/pet'
import { claimMails, deleteMails, INVENTORY_GRANT_KEY, onMailChange, readMails, type Live } from '../pet/mail'
import { photoUrl } from '../pet/album'
import { openPhoto } from './album'
import { openFrame } from './box'
import './css/email.css'
import { formatDate } from './date'
import { button, div, img } from './dom'
import { frame } from './frame'
import { windowView } from './window-view'
import { rewardIcon } from './reward-icon'

const BG = ['bg_01.png', 'bg_02.bmp', 'bg_03.png', 'bg_04.bmp', 'bg_05.bmp', 'bg_06.bmp', 'bg_8.png', 'bg_09.png', 'bg_10.png']

let open = false

/** Mail from the save: the original's, and the welcome, birthday and holiday mails. */
export function openEmail(): void {
  if (open) return
  open = true
  const live = (): Live[] => Object.values(readMails()).filter((m): m is Live => !m.e)
  const act = (list: Live[], remove = false): void => {
    try {
      const ids = list.map(m => String(m.d))
      if (remove) deleteMails(ids)
      else {
        const claimed = claimMails(ids)
        if (claimed.length) speak({ s: claimed.length === 1 ? claimed[0].m || '邮箱领取成功！' : '邮箱附件已全部收进背包啦~', now: true }, 'speak')
      }
    } catch (error) {
      console.error('Mail action failed:', error)
      windowView({ title: remove ? '删除邮件失败' : '领取附件失败', msg: '操作未完成，邮件已保留，请检查存档状态后重试。' })
    }
  }

  const attachments = (m: Live): HTMLElement => {
    const grant = m.k === INVENTORY_GRANT_KEY
    const icons = grant ? [...new Map(m.glb.map(g => [g.type, g])).values()] : m.glb
    return div('e_attachments',
      ...(grant ? [div('e_attachmentSummary', `${m.glb.length} 种物品，每种 1 份`)] : []),
      div('e_goodImgsBox', ...icons.map(g => Object.assign(img('e_goodImgs', rewardIcon(g.url)), { title: `${g.name}*${g.num}` }))),
    )
  }

  const emails = div('emails f1 h0')
  const render = (): void =>
    emails.replaceChildren(
      ...live().map((m) => {
        const row = div(
          'email fc',
          div(m.r ? 'leftType yjImg' : 'leftType uyjImg'),
          div(
            'rightMain f1 fC w0',
            div('e_title', m.l),
            div('e_time', formatDate(m.d, 'YYYY-MM-DD HH:mm')),
            div(
              'e_icons f1 mt2',
              m.p
                ? button('e_photo', () => openPhoto(m.p!), img('e_photoImg', photoUrl(m.p)))
                : attachments(m),
            ),
          ),
          button(m.r ? 'fcc rgetEmail' : 'fcc getEmail', () => act([m], m.r === true), m.r ? '删除' : '领取'),
        )
        row.dataset.mailId = String(m.d)
        return row
      }),
    )
  render()
  const unsubscribe = onMailChange(render)

  const close = (): void => {
    unsubscribe()
    closeFrame()
    open = false
  }
  const content = div(
    'Email fC',
    div('titleBox por fcc', div('title fcc', '邮箱'), button('close', close)),
    emails,
    div(
      'e_foot fcc',
      button('fcc wsnw getEmail getEmails', () => act(live().filter((m) => !m.r)), ' 一键领取 '),
      button('fcc wsnw rgetEmail rgetEmails', () => act(live().filter((m) => m.r), true), ' 一键删除 '),
    ),
  )
  const closeFrame = openFrame(
    div(
      'ui-email',
      frame(content, (n) => `pet/email/${BG[n - 1]}`, [12, 12]),
    ),
  )
}
