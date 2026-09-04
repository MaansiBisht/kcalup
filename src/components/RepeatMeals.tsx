'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { mealTypeFromHour } from '@/lib/nutrition'
import { hourIn } from '@/lib/date'
import type { Suggestion } from '@/lib/day'

/**
 * One-tap re-logging of meals already eaten. A horizontal strip rather than a
 * list, because it sits above the day and must not push it off the screen.
 */
export function RepeatMeals({
  suggestions,
  timezone,
}: {
  suggestions: Suggestion[]
  timezone: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A new account has nothing to repeat. An empty box would only be noise.
  if (suggestions.length === 0) return null

  async function repeat(mealId: string) {
    setPending(mealId)
    setError(null)

    // Same guess the camera makes: what you eat at 8am is breakfast.
    const { error: rpcError } = await supabaseBrowser().rpc('repeat_meal', {
      p_meal_id: mealId,
      p_meal_type: mealTypeFromHour(hourIn(timezone)),
    })

    if (rpcError) {
      setError('Could not log that again. Try again.')
      setPending(null)
      return
    }

    setPending(null)
    router.refresh()
  }

  return (
    <section aria-labelledby="repeat-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="repeat-heading" className="text-sm font-semibold text-ink">
          Log again
        </h2>
        <span className="text-xs text-muted">No photo needed</span>
      </div>

      {error && (
        <p role="alert" className="text-xs text-ink">
          {error}
        </p>
      )}

      {/* Bleeds past the page padding so the strip reads as scrollable. */}
      <ul className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.map((s) => (
          <li key={s.meal_id} className="snap-start">
            <button
              type="button"
              onClick={() => repeat(s.meal_id)}
              disabled={pending !== null}
              aria-label={`Log ${s.label ?? 'this meal'} again, ${s.calories} calories`}
              className="flex h-full w-[8.5rem] flex-col rounded-tile border border-hairline bg-paper p-2.5 text-left transition-[transform,border-color] hover:border-muted active:scale-[0.97] disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <span className="relative mb-2 block">
                {s.photoUrl ? (
                  /* Signed URLs expire, so next/image's cache would hold a dead link. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={s.photoUrl}
                    alt=""
                    width={80}
                    height={80}
                    loading="lazy"
                    className="aspect-square w-full rounded-[0.6rem] bg-cream object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex aspect-square w-full items-center justify-center rounded-[0.6rem] bg-cream text-xl"
                  >
                    🍽️
                  </span>
                )}

                {s.is_favourite && (
                  <span
                    aria-hidden
                    className="absolute top-1 left-1 rounded-full bg-paper/90 px-1.5 py-0.5 text-[0.625rem] leading-none backdrop-blur"
                  >
                    ★
                  </span>
                )}

                {s.times_logged > 1 && (
                  <span className="absolute right-1 bottom-1 rounded-full bg-graphite/85 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular-nums backdrop-blur">
                    ×{s.times_logged}
                  </span>
                )}
              </span>

              <span className="line-clamp-2 text-xs leading-snug font-semibold text-ink">
                {s.label ?? 'Untitled meal'}
              </span>

              <span className="mt-auto pt-1.5 text-[0.6875rem] font-medium text-muted tabular-nums">
                {pending === s.meal_id ? 'Adding…' : `${s.calories.toLocaleString()} kcal`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
