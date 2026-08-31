'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { validateImage, downscaleImage, ACCEPTED_TYPES } from '@/lib/image'
import { MEAL_IMAGES_BUCKET, mealImageKey } from '@/lib/storage'
import { analysisSchema, type FoodItem } from '@/lib/analysis'
import { mealTypeFromHour, type MealType } from '@/lib/nutrition'
import { hourIn } from '@/lib/date'
import { ReviewSheet } from './ReviewSheet'

type Stage = 'idle' | 'uploading' | 'analyzing' | 'review'

export function PhotoCapture({ timezone }: { timezone: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FoodItem[]>([])
  const [imageKey, setImageKey] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>('snack')

  // The manifest shortcut lands on /?action=photo — open the camera on arrival so
  // the loop starts on tap one.
  useEffect(() => {
    if (params.get('action') === 'photo') {
      cameraRef.current?.click()
      router.replace('/')
    }
  }, [params, router])

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setError(null)

      const invalid = validateImage(file)
      if (invalid) {
        setError(invalid)
        return
      }

      const supabase = supabaseBrowser()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        setError('Your session expired. Sign in again.')
        return
      }

      setStage('uploading')
      try {
        const blob = await downscaleImage(file)
        const key = mealImageKey(auth.user.id)

        const { error: uploadError } = await supabase.storage
          .from(MEAL_IMAGES_BUCKET)
          .upload(key, blob, { contentType: 'image/jpeg' })

        if (uploadError) throw new Error('Upload failed. Check your connection.')

        setImageKey(key)
        setStage('analyzing')

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageKey: key }),
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error ?? 'Analysis failed. Try again.')
        }

        const parsed = analysisSchema.safeParse(payload)
        if (!parsed.success) throw new Error('Got an unreadable response. Try again.')

        setItems(parsed.data.items)
        setMealType(mealTypeFromHour(hourIn(timezone)))
        setStage('review')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        setStage('idle')
      }
    },
    [timezone],
  )

  function reset() {
    setStage('idle')
    setItems([])
    setImageKey(null)
    setError(null)
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  const busy = stage === 'uploading' || stage === 'analyzing'

  return (
    <div className="space-y-2.5">
      {/* capture="environment" opens the rear camera on a phone and the file
          picker on desktop. Same element, both cases, no permission dance. */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-graphite px-5 py-4 text-[0.9375rem] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        {busy ? (
          <>
            <Spinner />
            {stage === 'uploading' ? 'Uploading photo…' : 'Reading your plate…'}
          </>
        ) : (
          <>
            <PlusGlyph />
            Take a food photo
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        disabled={busy}
        className="w-full rounded-card border border-hairline bg-paper px-5 py-3.5 text-[0.9375rem] font-medium text-ink transition-colors hover:bg-cream disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Upload from gallery
      </button>

      {error && (
        <p role="alert" className="rounded-tile bg-cream px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {stage === 'review' && (
        <ReviewSheet
          initialItems={items}
          imageKey={imageKey}
          mealType={mealType}
          onMealType={setMealType}
          onCancel={reset}
          onSaved={() => {
            reset()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function PlusGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
