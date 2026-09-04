import { shiftDate } from './date'

/** Far longer than any streak this app has had time to grow. */
const STREAK_WINDOW_DAYS = 365

export type Streak = {
  /** Consecutive days ending today, or ending yesterday while today is still open. */
  current: number
  /** Longest run anywhere in the supplied window. */
  longest: number
  loggedToday: boolean
}

/**
 * Streaks from the days that have at least one meal on them.
 *
 * The forgiving part is deliberate: a day you have not finished yet cannot have
 * broken anything. If today is empty but yesterday was logged the streak still
 * stands, so opening the app at 8am does not greet you with a zero you have
 * done nothing to deserve. It only breaks once a whole day has passed unlogged.
 */
export function streaksFrom(loggedDates: string[], today: string): Streak {
  const days = new Set(loggedDates)
  const loggedToday = days.has(today)

  // Anchor on today when it counts, otherwise on yesterday's still-standing run.
  const yesterday = shiftDate(today, -1)
  const anchor = loggedToday ? today : days.has(yesterday) ? yesterday : null

  let current = 0
  for (let d = anchor; d !== null && days.has(d); d = shiftDate(d, -1)) current++

  // Longest needs the whole window, so walk it in order rather than from an anchor.
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    run = previous !== null && shiftDate(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  return { current, longest, loggedToday }
}

/**
 * What to say when nothing is logged yet. The evening line is the check-in: by
 * then a blank day is almost certainly forgotten meals rather than a day that
 * has not happened. It only threatens the streak when there is one to lose --
 * warning someone their streak ends tonight when it broke days ago is a lie.
 */
export function nudgeFor(hour: number, hasStreak: boolean): { title: string; body: string } {
  if (hour < 12) {
    return {
      title: 'Nothing logged yet today',
      body: 'Breakfast is the easiest one to catch — it is usually the same photo.',
    }
  }
  if (hour < 18) {
    return {
      title: 'Nothing logged yet today',
      body: 'Log what you have eaten so far while you can still remember it.',
    }
  }
  return {
    title: 'Your day is still empty',
    body: hasStreak
      ? 'Add today’s meals before the day closes, or your streak ends tonight.'
      : 'Add one meal tonight and a new run starts tomorrow.',
  }
}

/**
 * The distinct days that carry at least one meal. A year is far more than any
 * streak this app has had time to grow, and it is one narrow column, so there
 * is no reason to page it.
 */
export async function loadLoggedDates(today: string): Promise<string[]> {
  const { supabaseServer } = await import('./supabase-server')
  const supabase = await supabaseServer()

  const { data } = await supabase
    .from('meals')
    .select('local_date')
    .gte('local_date', shiftDate(today, -STREAK_WINDOW_DAYS))
    .lte('local_date', today)

  return (data ?? []).map((r) => r.local_date as string)
}
