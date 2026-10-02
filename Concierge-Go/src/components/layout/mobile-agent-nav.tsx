'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Banknote, BriefcaseBusiness, Home, UserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/agent', label: 'Home', icon: Home },
  { href: '/agent/available', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/agent/earnings', label: 'Earnings', icon: Banknote },
  { href: '/agent/profile', label: 'Profile', icon: UserRound },
]

function isItemActive(pathname: string, href: string) {
  if (href === '/agent') return pathname === '/agent'
  return pathname.startsWith(href)
}

export function MobileAgentNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Go Agent navigation"
      className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-50 sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 items-center rounded-[1.7rem] border bg-background/92 p-1.5 shadow-xl backdrop-blur-xl">
        {ITEMS.map((item) => {
          const active = isItemActive(pathname, item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.2rem] px-2 text-[10px] font-semibold transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-[19px] w-[19px]" aria-hidden />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
