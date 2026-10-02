import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getServiceRoleKey, publicEnv } from '@/lib/env'

/**
 * Service-role client. Bypasses Row Level Security.
 *
 * `server-only` above makes importing this from a client component a build
 * error. Use it exclusively for operations that legitimately need to act
 * outside a user's permissions:
 *
 *   - verifying and recording payments (the customer must not be able to write
 *     their own payment status)
 *   - webhook handlers, which run with no user session
 *   - administrative writes performed after an explicit server-side role check
 *   - the seed script
 *
 * Every call site must perform its own authorization check first.
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
