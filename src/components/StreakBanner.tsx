import { nudgeFor, type Streak } from '@/lib/streak'

/**
 * The one thing on the page that argues for coming back tomorrow. It says
 * nothing at all to an account that has never logged, because a streak of zero
 * is not a motivator -- it is just a reminder that you are new.
 */
export function StreakBanner({ streak, hour }: { streak: Streak; hour: number }) {
  const { current, longest, loggedToday } = streak

  if (current === 0 && longest === 0) return null

  const atRisk = !loggedToday && current > 0
  const nudge = loggedToday ? null : nudgeFor(hour, current > 0)

  return (
    <section
      aria-label="Logging streak"
      className={`flex items-center gap-3.5 rounded-card px-4 py-3.5 ${
        atRisk && hour >= 18 ? 'bg-forest text-white' : 'bg-cream'
      }`}
    >
      {/* No flame for a run that does not exist -- a greyed badge just labels
          the reader a failure before they have read the sentence. */}
      {current > 0 && (
        <span
          aria-hidden
          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-base leading-none ${
            atRisk && hour >= 18 ? 'bg-white/15' : 'bg-paper'
          }`}
        >
          🔥
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            atRisk && hour >= 18 ? 'text-white' : 'text-ink'
          }`}
        >
          {current > 0
            ? `${current} day${current === 1 ? '' : 's'} in a row`
            : nudge?.title}
        </span>
        <span
          className={`mt-0.5 block text-xs ${
            atRisk && hour >= 18 ? 'text-white/70' : 'text-muted'
          }`}
        >
          {loggedToday
            ? longest > current
              ? `Logged today. Your best run is ${longest} days.`
              : current === longest && current > 1
                ? 'Logged today — this is your best run yet.'
                : 'Logged today.'
            : nudge?.body}
        </span>
      </span>
    </section>
  )
}
