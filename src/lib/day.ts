import { redirect } from 'next/navigation'
import { supabaseServer } from './supabase-server'
import { localDate } from './date'
import { MEAL_IMAGES_BUCKET } from './storage'
import type { MealType } from './nutrition'

/** Long enough to browse the day, short enough that a leaked link goes stale. */
const SIGNED_URL_TTL_SECONDS = 3600

/** Rendered at 40px, doubled for retina. */
const THUMB_PX = 80

export type Profile = {
  id: string
  name: string | null
  timezone: string
  daily_calorie_goal: number
  goal_type: 'lose' | 'maintain' | 'gain'
  target_weight_kg: number | null
  protein_goal_g: number | null
  carbs_goal_g: number | null
  fat_goal_g: number | null
}

export type DayMeal = {
  id: string
  meal_type: MealType
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  logged_at: string
  image_key: string | null
  photoUrl: string | null
  food_items: { name: string }[]
}

/** Every signed-in page needs the profile; an unsigned visitor needs the door. */
export async function requireProfile(): Promise<Profile> {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single()

  // The signup trigger creates the row; if it is somehow missing, onboarding
  // is a better destination than a crash.
  if (!profile) redirect('/onboarding')
  return profile as Profile
}

/** Today in the user's own timezone, not the server's. */
export function todayFor(profile: Profile): string {
  return localDate(profile.timezone)
}

export async function loadDay(date: string): Promise<DayMeal[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('meals')
    .select(
      'id, meal_type, calories, protein_g, carbs_g, fat_g, logged_at, image_key, food_items(name)',
    )
    .eq('local_date', date)
    .order('logged_at', { ascending: true })

  const meals = (data ?? []) as DayMeal[]

  // Signed in parallel rather than batched: only the single-path call takes a
  // transform, and an 80px thumbnail beats shipping the 1280px original.
  return Promise.all(
    meals.map(async (meal) => {
      if (!meal.image_key) return { ...meal, photoUrl: null }

      const { data: signed } = await supabase.storage
        .from(MEAL_IMAGES_BUCKET)
        .createSignedUrl(meal.image_key, SIGNED_URL_TTL_SECONDS, {
          transform: { width: THUMB_PX, height: THUMB_PX, resize: 'cover' },
        })

      return { ...meal, photoUrl: signed?.signedUrl ?? null }
    }),
  )
}

/**
 * Day totals for a range, one grouped query rather than a row per day. This is
 * what replaces the daily_logs cache table — derived, so it can never go stale.
 */
export async function loadDayTotals(from: string, to: string) {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('meals')
    .select('local_date, calories')
    .gte('local_date', from)
    .lte('local_date', to)
    .order('local_date', { ascending: false })

  const totals = new Map<string, number>()
  for (const row of (data ?? []) as { local_date: string; calories: number }[]) {
    totals.set(row.local_date, (totals.get(row.local_date) ?? 0) + row.calories)
  }
  return totals
}
