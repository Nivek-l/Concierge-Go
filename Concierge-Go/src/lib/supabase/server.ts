import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { publicEnv } from '@/lib/env'

/**
 * Server Supabase client bound to the request cookies. Anon key + RLS, so the
 * database enforces access even where application code forgets to.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}
