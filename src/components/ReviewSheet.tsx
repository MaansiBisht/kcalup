'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { FoodItem } from '@/lib/analysis'
import { sumItems, MEAL_TYPES, type MealType } from '@/lib/nutrition'

/** A blank row. The manual path opens the sheet with exactly one of these. */
export const BLANK_ITEM: FoodItem = {
  name: '',
  quantity: null,
  unit: null,
  calories: 0,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  confidence: null,
}

export function ReviewSheet({
  initialItems,
  imageKey,
  mealType,
  onMealType,
  onCancel,
  onSaved,
  manual = false,
}: {
  initialItems: FoodItem[]
  imageKey: string | null
  mealType: MealType
  onMealType: (t: MealType) => void
  onCancel: () => void
  onSaved: () => void
  /** Typed from memory rather than read off a photo. Only the wording differs. */
  manual?: boolean
}) {
  const [items, setItems] = useState<FoodItem[]>(initialItems)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totals = sumItems(items)
  const canSave = items.length > 0 && items.every((i) => i.name.trim().length > 0)

  // Immutable updates throughout — replace the row, never mutate it.
  function updateItem(index: number, patch: Partial<FoodItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    setError(null)
    const supabase = supabaseBrowser()

    const { error: rpcError } = await supabase.rpc('log_meal', {
      p_meal_type: mealType,
      p_image_key: imageKey,
      p_items: items.map((i) => ({ ...i, name: i.name.trim() })),
    })

    if (rpcError) {
      setError('Could not save that meal. Try again.')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <section
      role="dialog"
      aria-label={manual ? 'Add a meal by hand' : 'Review this meal'}
      className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-paper">
        <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-base font-bold tracking-tight text-ink">
            {manual ? 'Add a meal by hand' : 'Review this meal'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Say plainly where the numbers came from. On the manual path they
              are the user's own, so the estimate disclaimer would be a lie. */}
          <p className="mb-4 rounded-tile bg-cream px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            {manual
              ? 'Name each food and enter what you know. Calories are enough — macros are optional.'
              : 'These are AI estimates from your photo — tap any number to correct it before saving.'}
          </p>

          <fieldset className="mb-5">
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Meal
            </legend>
            <div className="flex gap-1.5">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onMealType(type)}
                  aria-pressed={mealType === type}
                  className={`flex-1 rounded-full px-2 py-2 text-xs font-medium capitalize transition-colors ${
                    mealType === type ? 'bg-forest text-white' : 'bg-cream text-muted hover:text-ink'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </fieldset>

          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={index} className="rounded-tile border border-hairline p-3">
                <div className="flex items-start gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    placeholder="Food name"
                    aria-label={`Item ${index + 1} name`}
                    className="min-w-0 flex-1 rounded-lg bg-cream px-2.5 py-1.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-muted focus:outline-2 focus:outline-forest"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label={`Remove ${item.name || 'item'}`}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-cream hover:text-ink"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <NumberField
                    label="Quantity"
                    value={item.quantity}
                    onChange={(v) => updateItem(index, { quantity: v })}
                  />
                  <label className="block">
                    <span className="mb-1 block text-[0.6875rem] font-medium text-muted">Unit</span>
                    <input
                      value={item.unit ?? ''}
                      onChange={(e) => updateItem(index, { unit: e.target.value || null })}
                      placeholder="g, cup…"
                      className="w-full rounded-lg bg-cream px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-forest"
                    />
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-2">
                  <NumberField
                    label="kcal"
                    value={item.calories}
                    integer
                    onChange={(v) => updateItem(index, { calories: Math.max(0, Math.round(v ?? 0)) })}
                  />
                  <NumberField
                    label="Protein"
                    value={item.protein_g}
                    onChange={(v) => updateItem(index, { protein_g: v })}
                  />
                  <NumberField
                    label="Carbs"
                    value={item.carbs_g}
                    onChange={(v) => updateItem(index, { carbs_g: v })}
                  />
                  <NumberField
                    label="Fat"
                    value={item.fat_g}
                    onChange={(v) => updateItem(index, { fat_g: v })}
                  />
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { ...BLANK_ITEM }])}
            className="mt-3 w-full rounded-tile border border-dashed border-hairline py-2.5 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-ink"
          >
            + Add an item
          </button>
        </div>

        <footer className="border-t border-hairline px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-muted">Meal total</span>
            <span className="text-xl font-bold tracking-tight text-ink tabular-nums">
              {totals.calories.toLocaleString()} kcal
            </span>
          </p>

          {error && (
            <p role="alert" className="mb-2 text-sm text-ink">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || !canSave}
            className="w-full rounded-card bg-graphite py-3.5 text-[0.9375rem] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add to today'}
          </button>
        </footer>
      </div>
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
  integer = false,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  integer?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.6875rem] font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={0}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
        className="w-full rounded-lg bg-cream px-2.5 py-1.5 text-sm text-ink tabular-nums focus:outline-2 focus:outline-forest"
      />
    </label>
  )
}
