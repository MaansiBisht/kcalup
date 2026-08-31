'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { validateImage, downscaleImage, ACCEPTED_TYPES } from '@/lib/image'
import { MEAL_IMAGES_BUCKET, mealImageKey } from '@/lib/storage'
import { analysisSchema, MAX_NOTE_LENGTH, type FoodItem } from '@/lib/analysis'
import { mealTypeFromHour, type MealType } from '@/lib/nutrition'
import { hourIn } from '@/lib/date'
import { ReviewSheet } from './ReviewSheet'
import { CAMERA_INPUT_ID } from './camera-input-id'

type Stage = 'idle' | 'describe' | 'uploading' | 'analyzing' | 'review'

export function PhotoCapture({ timezone }: { timezone: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLButtonElement>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<FoodItem[]>([])
  const [imageKey, setImageKey] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>('snack')
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Open the camera straight away; scroll and focus so it is one tap if iOS
  // refuses the programmatic click outside a user gesture.
  useEffect(() => {
    if (params.get('action') !== 'photo') return

    cameraRef.current?.click()
    captureRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    captureRef.current?.focus({ preventScroll: true })
    router.replace('/')
  }, [params, router])

  /** Choosing a photo only stages it. Nothing is uploaded until the user submits. */
  function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)

    const invalid = validateImage(file)
    if (invalid) {
      setError(invalid)
      return
    }

    setPicked(file)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    setStage('describe')
  }

  const analyze = useCallback(
    async (file: File) => {
      setError(null)
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
          body: JSON.stringify({
            imageKey: key,
            note: note.trim() || undefined,
          }),
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
        // Back to describe, not idle: the photo is still good, retrying is free.
        setStage('describe')
      }
    },
    [timezone, note],
  )

  function reset() {
    setStage('idle')
    setItems([])
    setImageKey(null)
    setError(null)
    setNote('')
    setPicked(null)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
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
        id={CAMERA_INPUT_ID}
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

      {stage === 'idle' && (
        <>
          <button
            ref={captureRef}
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
        </>
      )}

      {stage !== 'idle' && stage !== 'review' && preview && (
        <section aria-label="Confirm this photo" className="space-y-2.5">
          {/* blob: URL from the local file — next/image cannot optimise one. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="The meal you are about to log"
            width={1280}
            height={960}
            className="aspect-[4/3] w-full rounded-card object-cover"
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Describe it (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_NOTE_LENGTH}
              disabled={busy}
              placeholder="What is it? e.g. Beyond Burger, oat milk latte"
              className="w-full rounded-tile border border-hairline bg-paper px-4 py-3 text-[0.9375rem] text-ink placeholder:text-muted focus:border-forest focus:outline-none disabled:opacity-60"
            />
            <span className="mt-1 block text-[0.6875rem] text-muted">
              Helps when a photo cannot show a brand, a hidden ingredient, or what something was
              cooked in.
            </span>
          </label>

          <button
            type="button"
            onClick={() => picked && analyze(picked)}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-graphite px-5 py-4 text-[0.9375rem] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {busy ? (
              <>
                <Spinner />
                {stage === 'uploading' ? 'Uploading photo…' : 'Reading your plate…'}
              </>
            ) : (
              'Analyse this photo'
            )}
          </button>

          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="w-full py-2 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
          >
            Choose a different photo
          </button>
        </section>
      )}

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
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
