import { createBrowserClient } from '@supabase/ssr'

import { publicEnv } from '@/lib/env'

/**
 * Browser Supabase client. Uses the anon key only — every read and write it
 * performs is subject to Row Level Security.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
