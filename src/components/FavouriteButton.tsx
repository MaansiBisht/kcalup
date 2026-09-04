'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Pins a meal to the front of the "Log again" strip. Optimistic, because the
 * only failure worth a message is one that leaves the star wrong.
 */
export function FavouriteButton({
  mealId,
  initial,
}: {
  mealId: string
  initial: boolean
}) {
  const router = useRouter()
  const [starred, setStarred] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !starred
    setStarred(next)
    setBusy(true)

    // RLS scopes the update to the owner; no user_id filter can be forged in.
    const { error } = await supabaseBrowser()
      .from('meals')
      .update({ is_favourite: next })
      .eq('id', mealId)

    setBusy(false)
    if (error) {
      setStarred(!next)
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={starred}
      className={`flex w-full items-center justify-center gap-2 rounded-card border py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
        starred
          ? 'border-forest bg-forest text-white'
          : 'border-hairline text-muted hover:border-muted hover:text-ink'
      }`}
    >
      <span aria-hidden>{starred ? '★' : '☆'}</span>
      {starred ? 'Saved as a favourite' : 'Save as a favourite'}
    </button>
  )
}
