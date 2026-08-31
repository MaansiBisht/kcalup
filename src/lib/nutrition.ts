import type { FoodItem } from './analysis'

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

/** Meal type guessed from the clock. One tap to change it. */
export function mealTypeFromHour(hour: number): MealType {
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export function sumItems(items: Pick<FoodItem, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[]): Totals {
  return items.reduce<Totals>(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein_g: acc.protein_g + (i.protein_g || 0),
      carbs_g: acc.carbs_g + (i.carbs_g || 0),
      fat_g: acc.fat_g + (i.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

/** Progress toward the day's goal. Bar is capped at 100%; `remaining` is not. */
export function goalProgress(consumed: number, goal: number) {
  const safeGoal = goal > 0 ? goal : 1
  const pct = Math.round((consumed / safeGoal) * 100)
  return {
    pct,
    barPct: Math.max(0, Math.min(100, pct)),
    remaining: goal - consumed,
    over: consumed > goal,
  }
}
