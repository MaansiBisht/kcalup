'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { MacroInput, optionalInt } from '@/components/Field'

const GOAL_TYPES = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const [goal, setGoal] = useState('2000')
  const [goalType, setGoalType] = useState<string>('maintain')
  const [showMore, setShowMore] = useState(false)
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const calories = Number(goal)
    if (!Number.isFinite(calories) || calories < 500 || calories > 20000) {
      return setError('Enter a daily goal between 500 and 20,000 kcal.')
    }

    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      setBusy(false)
      return router.replace('/login')
    }

    // Capture the device timezone once. Every local_date the server computes
    // from here on depends on this being right.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        daily_calorie_goal: Math.round(calories),
        goal_type: goalType,
        timezone,
        protein_goal_g: optionalInt(protein),
        carbs_goal_g: optionalInt(carbs),
        fat_goal_g: optionalInt(fat),
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id)

    setBusy(false)
    if (updateError) return setError('Could not save that. Try again.')
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
        What&rsquo;s your daily calorie goal?
      </h1>
      <p className="mt-2 text-sm text-muted">
        One number is all we need. You can change it any time.
      </p>

      <form onSubmit={submit} className="mt-8">
        <div className="flex items-baseline gap-3 border-b-2 border-ink pb-2">
          <input
            type="number"
            inputMode="numeric"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            min={500}
            max={20000}
            autoFocus
            aria-label="Daily calorie goal"
            className="w-full bg-transparent text-5xl font-bold tracking-tight text-ink tabular-nums focus:outline-none"
          />
          <span className="text-sm font-medium text-muted">kcal</span>
        </div>

        <fieldset className="mt-6">
          <legend className="mb-2 text-xs font-medium text-muted">I want to</legend>
          <div className="flex gap-1.5">
            {GOAL_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGoalType(option.value)}
                aria-pressed={goalType === option.value}
                className={`flex-1 rounded-full px-3 py-2.5 text-xs font-medium transition-colors ${
                  goalType === option.value
                    ? 'bg-forest text-white'
                    : 'bg-cream text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Macros are optional and collapsed — one screen, one required number. */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="mt-6 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          {showMore ? '− Hide macro goals' : '+ Set macro goals (optional)'}
        </button>

        {showMore && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MacroInput label="Protein" value={protein} onChange={setProtein} />
            <MacroInput label="Carbs" value={carbs} onChange={setCarbs} />
            <MacroInput label="Fat" value={fat} onChange={setFat} />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-tile bg-cream px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-8 w-full rounded-card bg-graphite py-3.5 text-[0.9375rem] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Start tracking'}
        </button>
      </form>
    </main>
  )
}
