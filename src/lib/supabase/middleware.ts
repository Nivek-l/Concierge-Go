import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { publicEnv } from '@/lib/env'
import type { UserRole } from '@/types/database'

/** Route prefixes that require a session, and which roles may enter. */
const PROTECTED_PREFIXES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/dashboard', roles: ['customer', 'admin'] },
  { prefix: '/tasks', roles: ['customer', 'agent', 'admin'] },
  { prefix: '/profile', roles: ['customer', 'agent', 'admin'] },
  { prefix: '/notifications', roles: ['customer', 'agent', 'admin'] },
  { prefix: '/agent', roles: ['agent', 'admin'] },
  { prefix: '/admin', roles: ['admin'] },
]

const AUTH_ROUTES = ['/sign-in', '/sign-up', '/forgot-password']

/** Where each role belongs when they land somewhere they should not be. */
export function homeForRole(role: UserRole) {
  if (role === 'admin') return '/admin'
  if (role === 'agent') return '/agent'
  return '/dashboard'
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Without Supabase configured there is no session to police; the app shows
  // setup guidance instead of redirect-looping.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(
          ({
            name,
            value,
            options,
          }: {
            name: string
            value: string
            options?: CookieOptions
          }) => response.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser() revalidates the token with Supabase — do not swap for getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const match = PROTECTED_PREFIXES.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  )

  if (!user) {
    if (match) {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      url.search = ''
      url.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(url)
    }
    return response
  }

  // Role gate. The profile lookup is cheap and RLS-scoped to the caller's own
  // row. Server pages re-check independently — this is the first line, not the
  // only one.
  let role: UserRole = 'customer'
  let suspended = false
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_suspended')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    role = profile.role as UserRole
    suspended = Boolean(profile.is_suspended)
  }

  if (suspended && !pathname.startsWith('/account-suspended')) {
    const url = request.nextUrl.clone()
    url.pathname = '/account-suspended'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (match && !match.roles.includes(role)) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(role)
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(role)
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
