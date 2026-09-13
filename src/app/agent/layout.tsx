import { requireAgent } from '@/lib/auth'
import { PortalHeader } from '@/components/layout/portal-header'

const LINKS = [
  { href: '/agent', label: 'Dashboard' },
  { href: '/agent/available', label: 'Available tasks' },
  { href: '/agent/profile', label: 'Agent profile' },
]

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgent()

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <PortalHeader user={user} links={LINKS} profileHref="/agent/profile" eyebrow="Go Agent" />
      <main id="main" className="container flex-1 py-8 sm:py-10">
        {children}
      </main>
    </div>
  )
}
