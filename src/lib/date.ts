/**
 * The user's calendar date in their own timezone. The server recomputes this on
 * insert (see log_meal); this is the read-side twin, used to ask for "today".
 * 11:45 PM Aug 30 in IST is Aug 30, whatever UTC thinks.
 */
export function localDate(timezone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the Postgres date literal.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

export function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** "Monday, Aug 31" — the unconditional form, for headings that already say which day. */
export function formatFullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export function formatDayLabel(isoDate: string, today: string): string {
  if (isoDate === today) return 'Today'
  if (isoDate === shiftDate(today, -1)) return 'Yesterday'
  return formatFullDate(isoDate)
}

export function greeting(timezone: string, at: Date = new Date()): string {
  const hour = hourIn(timezone, at)
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function hourIn(timezone: string, at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(at),
  )
}
