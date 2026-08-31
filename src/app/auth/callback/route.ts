import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Where the confirmation link in the signup email lands. Supabase sends a `code`
 * that has to be traded for a session; without this route the link drops the user
 * on a page the proxy immediately bounces to /login.
 *
 * A Route Handler can write cookies, so the session set here sticks.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  const next = safeNext(searchParams.get('next'))

  if (!code) {
    // Supabase reports its own failures (expired or already-used link) this way.
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

/**
 * Where to land after a successful exchange. A confirmed signup has no goal yet
 * so onboarding is the default; the password reset link asks for /account.
 *
 * Only a single-slash relative path is allowed. "//evil.com" is protocol-relative
 * and "https://evil.com" is absolute — both would turn this into an open redirect
 * that a phisher could point at their own login page from a link that really does
 * start on your domain.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/onboarding'
  return raw
}
