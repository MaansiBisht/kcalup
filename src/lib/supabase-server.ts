import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          // Server Components cannot set cookies; middleware refreshes the session.
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {}
        },
      },
    },
  )
}
