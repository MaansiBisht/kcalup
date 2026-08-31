import Link from 'next/link'

export function AppHeader({ name }: { name: string | null }) {
  const initial = (name?.[0] ?? 'U').toUpperCase()

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-2">
      <Link href="/" className="text-xl font-bold tracking-tight text-ink">
        kcalup
      </Link>
      <Link
        href="/account"
        aria-label="Account"
        className="flex size-9 items-center justify-center rounded-full bg-cream text-sm font-semibold text-muted transition-colors hover:bg-hairline hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        {initial}
      </Link>
    </header>
  )
}
