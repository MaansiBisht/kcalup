'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Field } from '@/components/Field'

type Mode = 'signin' | 'signup' | 'reset'

const COPY: Record<Mode, { title: string; action: string; alt: string; altMode: Mode }> = {
  signin: {
    title: 'Welcome back',
    action: 'Sign in',
    alt: 'New here? Create an account',
    altMode: 'signup',
  },
  signup: {
    title: 'Start tracking',
    action: 'Create account',
    alt: 'Already have an account? Sign in',
    altMode: 'signin',
  },
  reset: {
    title: 'Reset password',
    action: 'Send reset link',
    alt: 'Back to sign in',
    altMode: 'signin',
  },
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // /auth/callback reports an expired or already-used link back here as ?error=.
  const [error, setError] = useState<string | null>(params.get('error'))
  const [notice, setNotice] = useState<string | null>(null)

  const copy = COPY[mode]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    const supabase = supabaseBrowser()

    if (mode === 'reset') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        // Same exchange the signup link needs — the code is useless without it.
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
      })
      setBusy(false)
      if (resetError) return setError(resetError.message)
      return setNotice('Check your email for a reset link.')
    }

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() || null },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      setBusy(false)
      if (signUpError) return setError(signUpError.message)

      // With email confirmation on, signUp returns no session. Redirecting to
      // /onboarding here would bounce straight back off the proxy and leave the
      // new user staring at an empty login form, which is what used to happen.
      if (!data.session) {
        return setNotice(`Almost there — confirm your address from the email we sent to ${email}, then sign in.`)
      }

      router.replace('/onboarding')
      return router.refresh()
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (signInError) return setError('That email and password did not match.')
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-12">
      <p className="text-2xl font-bold tracking-tight text-ink">kcalup</p>
      <h1 className="mt-8 text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
        {copy.title}
      </h1>
      <p className="mt-2 text-sm text-muted">Photo to calories in seconds.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === 'signup' && (
          <Field label="Name" value={name} onChange={setName} type="text" autoComplete="name" />
        )}
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          required
        />
        {mode !== 'reset' && (
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={8}
          />
        )}

        {error && (
          <p role="alert" className="rounded-tile bg-cream px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-tile bg-cream px-4 py-3 text-sm text-ink">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-card bg-graphite py-3.5 text-[0.9375rem] font-semibold text-white transition-transform active:scale-[0.985] disabled:opacity-60"
        >
          {busy ? 'Working…' : copy.action}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center">
        <button
          type="button"
          onClick={() => setMode(copy.altMode)}
          className="text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          {copy.alt}
        </button>
        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => setMode('reset')}
            className="block w-full text-sm text-muted transition-colors hover:text-ink"
          >
            Forgot your password?
          </button>
        )}
      </div>
    </main>
  )
}
