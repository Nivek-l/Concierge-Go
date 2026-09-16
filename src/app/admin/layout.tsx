import { requireAdmin } from '@/lib/auth'
import { PortalHeader } from '@/components/layout/portal-header'

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/tasks', label: 'Tasks' },
  { href: '/admin/agents', label: 'Agents' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/disputes', label: 'Disputes' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <PortalHeader user={user} links={LINKS} profileHref="/profile" eyebrow="Operations" />
      <main id="main" className="container w-full min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  )
}
