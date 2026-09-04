'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReviewSheet } from './ReviewSheet'
import type { FoodItem } from '@/lib/analysis'
import type { MealType } from '@/lib/nutrition'

/** The saved row carries an id the editor has no use for. */
export type SavedItem = FoodItem & { id: string }

/**
 * Opens the review sheet over a meal that is already saved. Same editor the
 * estimate lands in, so a correction is the same three taps as the first pass.
 */
export function EditMealButton({
  mealId,
  imageKey,
  mealType: savedType,
  items,
}: {
  mealId: string
  imageKey: string | null
  mealType: MealType
  items: SavedItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mealType, setMealType] = useState<MealType>(savedType)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-card border border-hairline bg-paper py-3 text-sm font-medium text-ink transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Edit this meal
      </button>

      {open && (
        <ReviewSheet
          mealId={mealId}
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          initialItems={items.map(({ id: _id, ...item }) => item)}
          imageKey={imageKey}
          mealType={mealType}
          onMealType={setMealType}
          onCancel={() => {
            setMealType(savedType)
            setOpen(false)
          }}
          onSaved={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
