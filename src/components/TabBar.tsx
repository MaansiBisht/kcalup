'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'Today', icon: HomeIcon },
  { href: '/?action=photo', label: 'Add food', icon: PlusIcon },
  { href: '/history', label: 'History', icon: ClockIcon },
] as const

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-10 border-t border-hairline bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const base = href.split('?')[0]
          const isPhoto = href.includes('action=photo')
          const active = !isPhoto && pathname === base

          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium transition-colors ${
                  active ? 'text-forest' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const strokeProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function HomeIcon() {
  return (
    <svg {...strokeProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg {...strokeProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
