import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { AppError, ERROR_MESSAGES } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { homeForRole } from '@/lib/supabase/middleware'
import type { AgentRow, ProfileRow, UserRole } from '@/types/database'
import type { SessionUser } from '@/types/domain'

/**
 * Server-side authorization.
 *
 * Middleware gives a fast redirect; these functions are the real gate. Every
 * protected page and every server action calls one of them, so a route that is
 * ever reached without the middleware still cannot leak data.
 *
 * Wrapped in React `cache` so a page that calls it in the layout, the page and
 * three actions still performs one lookup per request.
 */

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (!profile) return null

  let agent: AgentRow | null = null
  if (profile.role === 'agent') {
    const { data } = await supabase
      .from('agents')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle<AgentRow>()
    agent = data ?? null
  }

  return {
    id: user.id,
    email: user.email ?? profile.email,
    role: profile.role,
    profile,
    agent,
  }
})

/** Require any signed-in, non-suspended user. Redirects if absent. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    const target = nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : '/sign-in'
    redirect(target)
  }
  if (user.profile.is_suspended) redirect('/account-suspended')
  return user
}

/** Require one of the given roles, sending anyone else to their own home. */
export async function requireRole(roles: UserRole[], nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath)
  if (!roles.includes(user.role)) redirect(homeForRole(user.role))
  return user
}

export async function requireCustomer(nextPath?: string) {
  return requireRole(['customer'], nextPath)
}

export async function requireAgent(nextPath?: string): Promise<SessionUser & { agent: AgentRow }> {
  const user = await requireRole(['agent'], nextPath)
  if (!user.agent) {
    // An agent profile without an agent record cannot work; the operations
    // team resolves this from /admin/agents.
    redirect('/agent/verification')
  }
  return user as SessionUser & { agent: AgentRow }
}

export async function requireAdmin(nextPath?: string) {
  return requireRole(['admin'], nextPath)
}

/* -------------------------------------------------------------------------- */
/* Server-action variants — these throw instead of redirecting, so the action  */
/* can return a typed failure the form can render.                            */
/* -------------------------------------------------------------------------- */

export async function requireUserAction(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AppError(ERROR_MESSAGES.unauthorized, { code: 'unauthorized' })
  if (user.profile.is_suspended) {
    throw new AppError(
      'This account is suspended. Contact Concierge Go operations to restore access.',
      { code: 'suspended' },
    )
  }
  return user
}

export async function requireRoleAction(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUserAction()
  if (!roles.includes(user.role)) {
    throw new AppError(ERROR_MESSAGES.forbidden, { code: 'forbidden' })
  }
  return user
}

export async function requireAdminAction() {
  return requireRoleAction(['admin'])
}

export async function requireAgentAction(): Promise<SessionUser & { agent: AgentRow }> {
  const user = await requireRoleAction(['agent'])
  if (!user.agent) {
    throw new AppError('Your agent profile is not set up yet.', { code: 'no_agent' })
  }
  return user as SessionUser & { agent: AgentRow }
}

export async function requireCustomerAction() {
  return requireRoleAction(['customer'])
}
