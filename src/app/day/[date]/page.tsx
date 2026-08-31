import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { CalorieCard } from '@/components/CalorieCard'
import { MealList } from '@/components/MealList'
import { MacroTiles } from '@/components/MacroTiles'
import { TabBar } from '@/components/TabBar'
import { requireProfile, todayFor, loadDay } from '@/lib/day'
import { shiftDate, formatDayLabel } from '@/lib/date'
import { sumItems } from '@/lib/nutrition'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  // The date comes from the URL, so it is untrusted input for the query below.
  if (!ISO_DATE.test(date)) notFound()

  const profile = await requireProfile()
  const today = todayFor(profile)
  if (date > today) notFound()

  const meals = await loadDay(date)
  const totals = sumItems(meals)

  const prev = shiftDate(date, -1)
  const next = shiftDate(date, 1)
  const isToday = date === today

  return (
    <>
      <AppHeader name={profile.name} />

      <main className="flex-1 space-y-6 px-5 pt-2 pb-8">
        <nav aria-label="Day" className="flex items-center justify-between">
          <Link
            href={`/day/${prev}`}
            aria-label="Previous day"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            ←
          </Link>

          <h1 className="text-lg font-bold tracking-tight text-ink">
            {formatDayLabel(date, today)}
          </h1>

          {/* There is no future to log. Disabled, not hidden — the shape stays stable. */}
          {isToday ? (
            <span aria-disabled className="px-3 py-1.5 text-sm text-hairline select-none">
              →
            </span>
          ) : (
            <Link
              href={`/day/${next}`}
              aria-label="Next day"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-cream hover:text-ink"
            >
              →
            </Link>
          )}
        </nav>

        <CalorieCard
          consumed={totals.calories}
          goal={profile.daily_calorie_goal}
          label={isToday ? "Today's calories" : 'Calories'}
        />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Meals</h2>
          <MealList meals={meals} emptyHint="Nothing was logged on this day." />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Nutrition</h2>
          <MacroTiles totals={totals} goals={profile} />
        </section>
      </main>

      <TabBar />
    </>
  )
}
