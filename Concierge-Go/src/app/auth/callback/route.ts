import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { homeForRole } from '@/lib/supabase/middleware'
import type { UserRole } from '@/types/database'

/**
 * Supabase redirects here after a user clicks an email confirmation or
 * password-reset link. The `code` is exchanged for a session, then the
 * person is sent somewhere useful — their role's home, or `/reset-password`
 * when this is a password-reset link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      const role = (profile?.role ?? 'customer') as UserRole
      return NextResponse.redirect(`${origin}${homeForRole(role)}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=confirmation_failed`)
}
