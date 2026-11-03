import { pinkDiamondOffer } from '../../shared/pink-diamond'
import { pay } from '../pet/items'
import { speak } from '../pet/pet'
import { info } from '../pet/store'
import { openPinkDiamond } from '../pet/vip'
import { formatDate } from './date'
import { windowView } from './window-view'

/** One purchase path for the control menu, status badge and pet profile. */
export function openPinkDiamondPurchase(): void {
  const offer = (): ReturnType<typeof pinkDiamondOffer> => pinkDiamondOffer(info.PDgrowth, info.PDiamondLevel, info.PDiamondExpirationDate)
  const quoted = offer()
  let submitted = false
  windowView({
    title: quoted.active ? '粉钻续费' : '开通粉钻',
    msg: () => {
      const current = offer()
      const period = current.active ? `当前到期：${formatDate(info.PDiamondExpirationDate, 'YYYY-MM-DD HH:mm')}\n` : ''
      return `${period}${current.first ? '优惠开通' : current.active ? '续费' : '开通'}${current.days}天粉钻：${current.price}元宝`
    },
    ok: (close) => {
      if (submitted) return
      submitted = true
      if (offer().price !== quoted.price) return openPinkDiamondPurchase()
      close()
      if (!pay(quoted.price)) return
      openPinkDiamond(quoted.days)
      speak({ s: `[host],我们粉钻到${formatDate(info.PDiamondExpirationDate, 'YYYY-MM-DD HH:mm')}过期哦~`, now: true }, 'speak')
    },
  })
}
