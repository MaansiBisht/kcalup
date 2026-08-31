import { NextResponse } from 'next/server'
import { z } from 'zod'
import { chatCompletion } from '@/lib/ai'
import { supabaseServer } from '@/lib/supabase-server'
import { analysisSchema, extractAnalysis, ANALYZE_RESPONSE_FORMAT, ANALYZE_PROMPT } from '@/lib/analysis'
import { MEAL_IMAGES_BUCKET } from '@/lib/storage'

// The vision call is the slow part of this app; give it room.
export const maxDuration = 60

const HOURLY_LIMIT = 30
const DAILY_LIMIT = 100

const bodySchema = z.object({ imageKey: z.string().min(1).max(300) })

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const userId = auth.user.id

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const { imageKey } = parsedBody.data

  // The key is server-authoritative: it must live under this user's folder.
  // Without this, a valid session could analyse someone else's upload.
  if (!imageKey.startsWith(`${userId}/`)) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const limited = await checkRateLimit(supabase, userId)
  if (limited) return NextResponse.json({ error: limited }, { status: 429 })

  // The image has to travel through this function after all: Gemini's
  // OpenAI-compatible endpoint takes data: URIs only and rejects a remote URL
  // with a bare 400. Uploads are downscaled to 1280px client-side first, so this
  // is a few hundred KB, not the original camera file.
  const { data: file, error: downloadError } = await supabase.storage
    .from(MEAL_IMAGES_BUCKET)
    .download(imageKey)

  if (downloadError || !file) {
    return NextResponse.json({ error: 'Could not read that photo.' }, { status: 400 })
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const dataUri = `data:${file.type || 'image/jpeg'};base64,${base64}`

  await supabase.from('ai_calls').insert({ user_id: userId })

  try {
    const response = await chatCompletion({
      max_tokens: 1500,
      response_format: ANALYZE_RESPONSE_FORMAT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: ANALYZE_PROMPT },
          ],
        },
      ],
    })

    const raw = extractAnalysis(response)
    const parsed = analysisSchema.safeParse(raw)

    if (!parsed.success) {
      // A model that returns an empty list usually means "no food here", which is
      // a real answer, not a failure. Anything else is a genuine parse problem.
      const items = (raw as { items?: unknown[] })?.items
      if (Array.isArray(items) && items.length === 0) {
        return NextResponse.json({ error: 'No food found in that photo.' }, { status: 422 })
      }
      console.error('analysis parse failed', parsed.error.issues)
      return NextResponse.json({ error: 'Could not read that photo. Try again.' }, { status: 502 })
    }

    return NextResponse.json(parsed.data)
  } catch (error) {
    console.error('analyze failed', error)

    // A provider auth or plan problem is not a transient failure, and telling the
    // user to "try again" would loop forever. Separate it from a real hiccup.
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: 'The AI provider rejected this request. Check the API key and plan.' },
        { status: 502 },
      )
    }
    if (status === 404) {
      return NextResponse.json(
        { error: 'AI model or endpoint not found. Check AI_MODEL and AI_BASE_URL.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ error: 'Analysis failed. Try again.' }, { status: 502 })
  }
}

/** Hourly smooths bursts; daily is what protects the AI balance from a retry loop. */
async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
): Promise<string | null> {
  const now = Date.now()
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  const { count: dayCount } = await supabase
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayAgo)

  if ((dayCount ?? 0) >= DAILY_LIMIT) {
    return 'Daily photo limit reached. Try again tomorrow.'
  }

  const { count: hourCount } = await supabase
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', hourAgo)

  if ((hourCount ?? 0) >= HOURLY_LIMIT) {
    return 'Too many photos in the last hour. Give it a few minutes.'
  }

  return null
}
