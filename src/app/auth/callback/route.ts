import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/** Where the signup and reset emails land: trades Supabase's `code` for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  const next = safeNext(searchParams.get('next'))

  if (!code) {
    // Supabase reports an expired or already-used link this way.
    const reason = searchParams.get('error_description') ?? 'That link is no longer valid.'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`)
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('That confirmation link has expired. Sign in to get a new one.')}`,
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}

/** Relative single-slash paths only; anything else is an open redirect. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/onboarding'
  return raw
}
