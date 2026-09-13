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
      <main id="main" className="container flex-1 py-8 sm:py-10">
        {children}
      </main>
    </div>
  )
}
