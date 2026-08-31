import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { TabBar } from '@/components/TabBar'
import { requireProfile, todayFor, loadDayTotals } from '@/lib/day'
import { shiftDate, formatDayLabel } from '@/lib/date'

const DAYS_SHOWN = 30

export default async function HistoryPage() {
  const profile = await requireProfile()
  const today = todayFor(profile)
  const from = shiftDate(today, -(DAYS_SHOWN - 1))

  // One grouped query for the whole window, not one per day.
  const totals = await loadDayTotals(from, today)

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => shiftDate(today, -i))
  const loggedCount = days.filter((d) => (totals.get(d) ?? 0) > 0).length

  return (
    <>
      <AppHeader name={profile.name} />

      <main className="flex-1 space-y-6 px-5 pt-2 pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">History</h1>
          <p className="mt-1 text-sm text-muted">
            {loggedCount > 0
              ? `${loggedCount} of the last ${DAYS_SHOWN} days logged`
              : 'The last 30 days'}
          </p>
        </div>

        {loggedCount === 0 ? (
          <p className="rounded-tile border border-dashed border-hairline px-4 py-10 text-center text-sm text-muted">
            Nothing logged yet. Days show up here once you add a meal.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {days.map((date) => {
              const consumed = totals.get(date) ?? 0
              if (consumed === 0) return null
              const pct = Math.min(100, Math.round((consumed / profile.daily_calorie_goal) * 100))

              return (
                <li key={date}>
                  <Link
                    href={`/day/${date}`}
                    className="-mx-2 flex items-center gap-4 rounded-tile px-2 py-3.5 transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {formatDayLabel(date, today)}
                      </span>
                      <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-cream">
                        <span
                          className="block h-full rounded-full bg-moss"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>

                    <span className="text-right">
                      <span className="block text-sm font-semibold text-ink tabular-nums">
                        {consumed.toLocaleString()}
                      </span>
                      <span className="block text-xs text-muted tabular-nums">
                        / {profile.daily_calorie_goal.toLocaleString()}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <TabBar />
    </>
  )
}
