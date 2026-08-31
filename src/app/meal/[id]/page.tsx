import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { TabBar } from '@/components/TabBar'
import { DeleteMealButton } from '@/components/DeleteMealButton'
import { requireProfile, todayFor } from '@/lib/day'
import { supabaseServer } from '@/lib/supabase-server'
import { formatDayLabel } from '@/lib/date'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type MealDetail = {
  id: string
  meal_type: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  local_date: string
  logged_at: string
  food_items: {
    id: string
    name: string
    quantity: number | null
    unit: string | null
    calories: number
  }[]
}

export default async function MealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const profile = await requireProfile()
  const supabase = await supabaseServer()

  // No user_id filter needed — RLS makes another user's meal simply not exist here.
  const { data } = await supabase
    .from('meals')
    .select(
      'id, meal_type, calories, protein_g, carbs_g, fat_g, local_date, logged_at, food_items(id, name, quantity, unit, calories)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const meal = data as MealDetail
  const today = todayFor(profile)

  const loggedTime = new Date(meal.logged_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: profile.timezone,
  })

  return (
    <>
      <AppHeader name={profile.name} />

      <main className="flex-1 space-y-6 px-5 pt-2 pb-8">
        <div>
          <Link
            href={`/day/${meal.local_date}`}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            ← {formatDayLabel(meal.local_date, today)}
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink capitalize">
            {meal.meal_type}
          </h1>
          <p className="mt-1 text-sm text-muted">Logged at {loggedTime}</p>
        </div>

        <section className="rounded-card bg-forest px-6 py-5 text-white">
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-white/60 uppercase">
            Meal total
          </p>
          <p className="mt-2 text-[2.25rem] leading-none font-bold tracking-tight tabular-nums">
            {meal.calories.toLocaleString()}
            <span className="ml-1.5 text-sm font-medium text-white/55">kcal</span>
          </p>
          <dl className="mt-4 flex gap-6 text-xs text-white/70">
            <Macro label="Protein" value={meal.protein_g} />
            <Macro label="Carbs" value={meal.carbs_g} />
            <Macro label="Fat" value={meal.fat_g} />
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Items</h2>
          <ul className="divide-y divide-hairline">
            {meal.food_items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{item.name}</span>
                  {item.quantity !== null && (
                    <span className="block text-xs text-muted">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                  )}
                </span>
                <span className="text-sm text-ink tabular-nums">{item.calories}</span>
              </li>
            ))}
          </ul>
        </section>

        <DeleteMealButton mealId={meal.id} returnTo={`/day/${meal.local_date}`} />
      </main>

      <TabBar />
    </>
  )
}

function Macro({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-white/55">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{Math.round(value ?? 0)}g</dd>
    </div>
  )
}
