import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { TabBar } from '@/components/TabBar'
import { WeightForm } from '@/components/WeightForm'
import { WeightTrend } from '@/components/WeightTrend'
import { requireProfile, todayFor, loadDayTotals } from '@/lib/day'
import { loadWeights } from '@/lib/weight'
import { shiftDate, formatDayLabel } from '@/lib/date'

const DAYS_SHOWN = 30

export default async function HistoryPage() {
  const profile = await requireProfile()
  const today = todayFor(profile)
  const from = shiftDate(today, -(DAYS_SHOWN - 1))

  // Independent reads, so they go together rather than one after the other.
  const [totals, weights] = await Promise.all([
    loadDayTotals(from, today),
    loadWeights(from, today),
  ])
  const todaysWeight = weights.find((w) => w.local_date === today)?.weight_kg ?? null

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

        <section aria-labelledby="weight-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="weight-heading" className="text-sm font-semibold text-ink">
              Weight
            </h2>
            <span className="text-xs text-muted">
              {profile.target_weight_kg !== null
                ? `Target ${profile.target_weight_kg} kg`
                : 'No target set'}
            </span>
          </div>

          <WeightForm todaysWeight={todaysWeight} />
          <WeightTrend points={weights} target={profile.target_weight_kg} />

          {/* The table view. Every reading the chart smooths is readable here. */}
          {weights.length > 0 && (
            <details className="rounded-tile border border-hairline px-3.5 py-2.5">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                All {weights.length} weigh-in{weights.length === 1 ? '' : 's'}
              </summary>
              <table className="mt-2 w-full text-xs">
                <caption className="sr-only">Recorded weights, newest first</caption>
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className="py-1 text-left font-medium">
                      Day
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      Weight
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {[...weights].reverse().map((w) => (
                    <tr key={w.local_date}>
                      <td className="py-1.5 text-ink">{formatDayLabel(w.local_date, today)}</td>
                      <td className="py-1.5 text-right text-ink tabular-nums">
                        {w.weight_kg.toFixed(1)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </section>

        <section aria-labelledby="intake-heading" className="space-y-3">
          <h2 id="intake-heading" className="text-sm font-semibold text-ink">
            Daily intake
          </h2>

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
        </section>
      </main>

      <TabBar />
    </>
  )
}
