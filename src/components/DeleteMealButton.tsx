'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export function DeleteMealButton({ mealId, returnTo }: { mealId: string; returnTo: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()

    // RLS scopes this to the owner; food_items go with it via cascade.
    const { error: deleteError } = await supabase.from('meals').delete().eq('id', mealId)

    if (deleteError) {
      setError('Could not delete that meal. Try again.')
      setBusy(false)
      return
    }
    router.replace(returnTo)
    router.refresh()
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-card border border-hairline py-3 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-ink"
      >
        Delete this meal
      </button>
    )
  }

  return (
    <div className="rounded-card border border-hairline p-4">
      <p className="text-sm font-medium text-ink">Delete this meal?</p>
      <p className="mt-1 text-xs text-muted">This removes it from your day. It cannot be undone.</p>

      {error && (
        <p role="alert" className="mt-2 text-xs text-ink">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex-1 rounded-tile bg-cream py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hairline"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="flex-1 rounded-tile bg-graphite py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
