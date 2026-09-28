'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ListTodo, MapPinned, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileNavItem { href: string; label: string; icon: typeof Home; primary?: boolean }
const ITEMS: MobileNavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/tasks/new', label: 'New', icon: Plus, primary: true },
  { href: '/track', label: 'Track', icon: MapPinned },
]

export function MobileCustomerNav() {
  const pathname = usePathname()
  return <nav aria-label="Customer navigation" className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-50 sm:hidden">
    <div className="mx-auto grid max-w-md grid-cols-4 items-center rounded-[1.7rem] border bg-background/92 p-1.5 shadow-xl backdrop-blur-xl">
      {ITEMS.map((item) => {
        const active = item.href === '/dashboard' ? pathname === '/dashboard' : item.href === '/tasks' ? pathname === '/tasks' || /^\/tasks\/[^/]+$/.test(pathname) : pathname.startsWith(item.href)
        const Icon = item.icon
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.2rem] px-2 text-[10px] font-semibold transition-all', item.primary ? 'bg-primary text-primary-foreground shadow-md' : active ? 'bg-primary-subtle text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <Icon className="h-[18px] w-[18px]" aria-hidden /><span>{item.label}</span>
        </Link>
      })}
    </div>
  </nav>
}
