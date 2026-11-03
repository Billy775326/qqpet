import { SWEETHEART_DAILY_PRICE, sweetHeartCapacity } from '../../shared/sweetheart'
import { pay } from '../pet/items'
import { speak } from '../pet/pet'
import { info } from '../pet/store'
import { addSweetHeart } from '../pet/vip'
import { formatDate } from './date'
import { windowView } from './window-view'

/** Buying or extending a booking shares the same cap on the actual remaining period. */
export function openSweetHeartPurchase(): void {
  const capacity = (): ReturnType<typeof sweetHeartCapacity> => sweetHeartCapacity(info.sweetHeartOverTime)
  windowView({
    msg: () => {
      const { remainingDays, availableDays } = capacity()
      return availableDays
        ? `剩余约${remainingDays}天，最多可续${availableDays}天\n托管费用：${SWEETHEART_DAILY_PRICE}元宝/一天`
        : `剩余约${remainingDays}天，暂无可充值天数\n剩余时长上限为30天`
    },
    max: () => capacity().availableDays,
    sweet: true,
    ok: (close, days) => {
      // The balance must not change when another renewal has consumed the remaining capacity.
      if (!Number.isInteger(days) || days < 1 || days > capacity().availableDays) return
      close()
      if (!pay(SWEETHEART_DAILY_PRICE * days)) return
      addSweetHeart(days)
      speak({ s: `[host],贴心宝贝${formatDate(info.sweetHeartOverTime)}过期，我真是太爱你了！~`, now: true }, 'speak')
    },
  })
}
