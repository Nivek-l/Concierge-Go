import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { homeForRole } from '@/lib/supabase/middleware'
import { PortalHeader } from '@/components/layout/portal-header'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tasks', label: 'My tasks' },
  { href: '/tasks/new', label: 'Request a task' },
  { href: '/tasks/ai', label: 'Request with AI' },
  { href: '/profile', label: 'Profile' },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  // /dashboard also admits admins (they may want the customer view for demo
  // purposes) but the rest of this shell is built for a customer.
  if (user.role === 'agent') redirect(homeForRole('agent'))

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <PortalHeader user={user} links={LINKS} />
      <main id="main" className="container w-full min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  )
}
