'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { deviceTimezone, FALLBACK_TIMEZONE } from '@/lib/date'

/**
 * The DB default 'UTC' means "timezone never captured", not "the user is in
 * London" — so when the device disagrees, the device wins, once.
 */
export function TimezoneSync({ userId, timezone }: { userId: string; timezone: string }) {
  const router = useRouter()

  useEffect(() => {
    const device = deviceTimezone()
    if (timezone !== FALLBACK_TIMEZONE || device === FALLBACK_TIMEZONE) return

    supabaseBrowser()
      .from('profiles')
      .update({ timezone: device, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .then(() => router.refresh())
  }, [userId, timezone, router])

  return null
}
