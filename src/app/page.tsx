import { Suspense } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { CalorieCard } from '@/components/CalorieCard'
import { PhotoCapture } from '@/components/PhotoCapture'
import { MealList } from '@/components/MealList'
import { MacroTiles } from '@/components/MacroTiles'
import { TabBar } from '@/components/TabBar'
import { requireProfile, todayFor, loadDay } from '@/lib/day'
import { greeting, formatFullDate } from '@/lib/date'
import { sumItems } from '@/lib/nutrition'

export default async function TodayPage() {
  const profile = await requireProfile()
  const today = todayFor(profile)
  const meals = await loadDay(today)
  const totals = sumItems(meals)

  return (
    <>
      <AppHeader name={profile.name} />

      <main className="flex-1 space-y-6 px-5 pt-2 pb-8">
        <div>
          <p className="text-sm text-muted">{greeting(profile.timezone)}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">{formatFullDate(today)}</h1>
        </div>

        <CalorieCard consumed={totals.calories} goal={profile.daily_calorie_goal} />

        {/* useSearchParams needs a Suspense boundary during prerender. */}
        <Suspense fallback={<div className="h-[7.5rem]" />}>
          <PhotoCapture timezone={profile.timezone} />
        </Suspense>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Today&rsquo;s meals</h2>
            <Link
              href="/history"
              className="text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              View history
            </Link>
          </div>
          <MealList meals={meals} emptyHint="Nothing logged yet. Your first photo starts the day." />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Nutrition</h2>
            <span className="text-xs text-muted">Today</span>
          </div>
          <MacroTiles totals={totals} goals={profile} />
        </section>
      </main>

      <TabBar />
    </>
  )
}
