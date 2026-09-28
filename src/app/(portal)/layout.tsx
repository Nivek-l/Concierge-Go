import { redirect } from 'next/navigation'
import { Home, ListTodo, MapPinned, Plus } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { homeForRole } from '@/lib/supabase/middleware'
import { PortalHeader } from '@/components/layout/portal-header'
import { MobileCustomerNav } from '@/components/layout/mobile-customer-nav'

const LINKS = [
  { href: '/dashboard', label: 'Home', icon: Home }, { href: '/tasks/new', label: 'New Task', icon: Plus }, { href: '/tasks', label: 'My Tasks', icon: ListTodo }, { href: '/track', label: 'Track', icon: MapPinned },
]
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); if (user.role === 'agent') redirect(homeForRole('agent'))
  return <div className="flex min-h-dvh flex-col bg-background"><PortalHeader user={user} links={LINKS} /><main id="main" className="container w-full min-w-0 flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-10 lg:px-8 lg:py-10">{children}</main><MobileCustomerNav /></div>
}
