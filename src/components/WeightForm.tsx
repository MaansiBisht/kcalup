'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

/** Matches the CHECK constraint on weights.weight_kg, so the UI refuses first. */
const MIN_KG = 20
const MAX_KG = 500

export function WeightForm({ todaysWeight }: { todaysWeight: number | null }) {
  const router = useRouter()
  const [value, setValue] = useState(todaysWeight?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const kg = Number(value)
    if (!value.trim() || !Number.isFinite(kg) || kg <= MIN_KG || kg >= MAX_KG) {
      setError(`Enter a weight between ${MIN_KG} and ${MAX_KG} kg.`)
      return
    }

    setSaving(true)
    setError(null)

    // Upserts on today's date server-side; re-weighing replaces rather than stacks.
    const { error: rpcError } = await supabaseBrowser().rpc('log_weight', {
      p_weight_kg: kg,
    })

    setSaving(false)
    if (rpcError) {
      setError('Could not save that weight. Try again.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Today&rsquo;s weight in kilograms</span>
          <span className="flex items-baseline rounded-tile border border-hairline bg-paper px-4 py-3 focus-within:border-forest">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={MIN_KG}
              max={MAX_KG}
              placeholder="0.0"
              disabled={saving}
              className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink tabular-nums placeholder:text-muted focus:outline-none"
            />
            <span aria-hidden className="ml-2 text-xs font-medium text-muted">
              kg
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-tile bg-graphite px-5 text-sm font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {saving ? 'Saving…' : todaysWeight === null ? 'Log' : 'Update'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-ink">
          {error}
        </p>
      )}

      <p className="text-[0.6875rem] text-muted">
        {todaysWeight === null
          ? 'One reading a day is plenty. Morning, before eating, is the most comparable.'
          : 'Already logged today. Saving again replaces it.'}
      </p>
    </div>
  )
}
