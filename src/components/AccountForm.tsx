'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { MEAL_IMAGES_BUCKET } from '@/lib/storage'
import type { Profile } from '@/lib/day'
import { Field, MacroInput, optionalInt } from './Field'

const GOAL_TYPES = ['lose', 'maintain', 'gain'] as const

export function AccountForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [name, setName] = useState(profile.name ?? '')
  const [goal, setGoal] = useState(String(profile.daily_calorie_goal))
  const [goalType, setGoalType] = useState<string>(profile.goal_type)
  const [protein, setProtein] = useState(profile.protein_goal_g?.toString() ?? '')
  const [carbs, setCarbs] = useState(profile.carbs_goal_g?.toString() ?? '')
  const [fat, setFat] = useState(profile.fat_goal_g?.toString() ?? '')
  const [targetWeight, setTargetWeight] = useState(profile.target_weight_kg?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const calories = Number(goal)
    if (!Number.isFinite(calories) || calories < 500 || calories > 20000) {
      return setError('Enter a daily goal between 500 and 20,000 kcal.')
    }

    // Matches the weights CHECK range, so a target cannot be set somewhere no
    // reading could ever reach.
    const target = targetWeight.trim() === '' ? null : Number(targetWeight)
    if (target !== null && (!Number.isFinite(target) || target <= 20 || target >= 500)) {
      return setError('Enter a target weight between 20 and 500 kg, or leave it blank.')
    }

    setBusy(true)
    setError(null)
    setStatus(null)

    const supabase = supabaseBrowser()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: name.trim() || null,
        daily_calorie_goal: Math.round(calories),
        goal_type: goalType,
        target_weight_kg: target,
        // Refresh the timezone on save — people move, and every future
        // local_date depends on this being current.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || profile.timezone,
        protein_goal_g: optionalInt(protein),
        carbs_goal_g: optionalInt(carbs),
        fat_goal_g: optionalInt(fat),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    setBusy(false)
    if (updateError) return setError('Could not save. Try again.')
    setStatus('Saved.')
    router.refresh()
  }

  async function signOut() {
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name" value={name} onChange={setName} type="text" />

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Daily calorie goal</span>
          <input
            type="number"
            inputMode="numeric"
            min={500}
            max={20000}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full rounded-tile border border-hairline bg-paper px-4 py-3 text-[0.9375rem] text-ink tabular-nums focus:border-forest focus:outline-none"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Goal</legend>
          <div className="flex gap-1.5">
            {GOAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setGoalType(type)}
                aria-pressed={goalType === type}
                className={`flex-1 rounded-full px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                  goalType === type ? 'bg-forest text-white' : 'bg-cream text-muted hover:text-ink'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Target weight (optional)
          </span>
          <span className="flex items-baseline rounded-tile border border-hairline bg-paper px-4 py-3 focus-within:border-forest">
            <input
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={20}
              max={500}
              placeholder="Not set"
              className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink tabular-nums placeholder:text-muted focus:outline-none"
            />
            <span aria-hidden className="ml-2 text-xs font-medium text-muted">
              kg
            </span>
          </span>
          <span className="mt-1 block text-[0.6875rem] text-muted">
            Sets the target line on your weight trend in History.
          </span>
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Macro goals (optional)</legend>
          <div className="grid grid-cols-3 gap-2">
            <MacroInput label="Protein" value={protein} onChange={setProtein} />
            <MacroInput label="Carbs" value={carbs} onChange={setCarbs} />
            <MacroInput label="Fat" value={fat} onChange={setFat} />
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-tile bg-cream px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="text-sm text-muted">
            {status}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-card bg-graphite py-3.5 text-[0.9375rem] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="space-y-3 border-t border-hairline pt-6">
        <p className="text-xs text-muted">Timezone: {profile.timezone}</p>

        <button
          type="button"
          onClick={signOut}
          className="w-full rounded-card border border-hairline py-3 text-sm font-medium text-ink transition-colors hover:bg-cream"
        >
          Sign out
        </button>

        <DeleteAccount userId={profile.id} />
      </div>
    </div>
  )
}

function DeleteAccount({ userId }: { userId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function destroy() {
    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()

    // Purge the storage folder first. If the profile row went first, RLS would
    // stop us reaching the objects and they would be orphaned forever.
    const { data: files } = await supabase.storage.from(MEAL_IMAGES_BUCKET).list(userId)
    if (files?.length) {
      await supabase.storage
        .from(MEAL_IMAGES_BUCKET)
        .remove(files.map((f) => `${userId}/${f.name}`))
    }

    // Cascades to meals, food_items and ai_calls.
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', userId)
    if (deleteError) {
      setError('Could not delete your account. Try again.')
      setBusy(false)
      return
    }

    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full py-2 text-sm text-muted transition-colors hover:text-ink"
      >
        Delete account
      </button>
    )
  }

  return (
    <div className="rounded-card border border-hairline p-4">
      <p className="text-sm font-medium text-ink">Delete your account?</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Every meal, photo and goal is removed permanently. Type <strong>DELETE</strong> to confirm.
      </p>

      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label="Type DELETE to confirm"
        className="mt-3 w-full rounded-tile border border-hairline bg-paper px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none"
      />

      {error && (
        <p role="alert" className="mt-2 text-xs text-ink">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            setTyped('')
          }}
          disabled={busy}
          className="flex-1 rounded-tile bg-cream py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hairline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={destroy}
          disabled={busy || typed !== 'DELETE'}
          className="flex-1 rounded-tile bg-graphite py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
