/** Formats unix seconds with the YYYY MM DD HH mm ss tokens. */
export function formatDate(sec: number, fmt = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(sec * 1000)
  const p = (n: number): string => String(n).padStart(2, '0')
  const parts: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    MM: p(d.getMonth() + 1),
    DD: p(d.getDate()),
    HH: p(d.getHours()),
    mm: p(d.getMinutes()),
    ss: p(d.getSeconds()),
  }
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (t) => parts[t])
}

/** Membership expiry is Unix seconds, independent of day rollover and the care on/off switch. */
export function remainingTime(expiresAt: number, now = Date.now() / 1000): string {
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return '未开通'
  const seconds = Math.ceil(expiresAt - now)
  if (seconds <= 0) return '已到期'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${Math.floor(seconds / 86400)}天 ${pad(Math.floor(seconds / 3600) % 24)}小时${pad(Math.floor(seconds / 60) % 60)}分${pad(seconds % 60)}秒`
}
