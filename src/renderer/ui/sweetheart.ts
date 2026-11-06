import { SWEETHEART_DAILY_PRICE, SWEETHEART_MAX_DAYS, sweetHeartCapacity } from '../../shared/sweetheart'
import { pay } from '../pet/items'
import { speak } from '../pet/pet'
import { info } from '../pet/store'
import { addSweetHeart } from '../pet/vip'
import { formatDate } from './date'
import { div } from './dom'
import { openCareSettings } from './care-settings'
import { windowView } from './window-view'

/** Buying or extending a booking shares the same cap on the actual remaining period. */
export function openSweetHeartPurchase(): void {
  const capacity = (): ReturnType<typeof sweetHeartCapacity> => sweetHeartCapacity(info.sweetHeartOverTime)
  windowView({
    msg: () => {
      const { remainingDays, availableDays } = capacity()
      const value = (n: number): HTMLElement => div('sweetHeartValue', String(n))
      return div(
        'sweetHeartSummary',
        div(
          'sweetHeartPeriod',
          div('sweetHeartRemaining', '剩余约', value(remainingDays), '天'),
          div('sweetHeartAvailable', ...(availableDays ? ['最多可续', value(availableDays), '天'] : ['暂不可续费'])),
        ),
        availableDays
          ? div('sweetHeartPrice', '托管费用：', value(SWEETHEART_DAILY_PRICE), ' 元宝 / 天')
          : div('sweetHeartPrice', '剩余时长上限 ', value(SWEETHEART_MAX_DAYS), ' 天'),
      )
    },
    max: () => capacity().availableDays,
    sweet: true,
    sweetSettings: openCareSettings,
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
