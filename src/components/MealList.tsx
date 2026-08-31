import Link from 'next/link'
import type { MealType } from '@/lib/nutrition'

export type MealRow = {
  id: string
  meal_type: MealType
  calories: number
  food_items: { name: string }[]
}

const MEAL_GLYPH: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍛',
  dinner: '🍽️',
  snack: '☕',
}

export function MealList({ meals, emptyHint }: { meals: MealRow[]; emptyHint: string }) {
  if (meals.length === 0) {
    return (
      <p className="rounded-tile border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">
        {emptyHint}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-hairline">
      {meals.map((meal) => (
        <li key={meal.id}>
          <Link
            href={`/meal/${meal.id}`}
            className="-mx-2 flex items-center gap-3.5 rounded-tile px-2 py-3 transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream text-lg"
            >
              {MEAL_GLYPH[meal.meal_type]}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink capitalize">{meal.meal_type}</span>
              <span className="block truncate text-xs text-muted">
                {meal.food_items.map((i) => i.name).join(' · ') || 'No items'}
              </span>
            </span>

            <span className="text-sm font-semibold text-ink tabular-nums">{meal.calories}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
