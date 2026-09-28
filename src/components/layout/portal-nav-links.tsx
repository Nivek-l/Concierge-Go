'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { PortalNavLink } from '@/components/layout/portal-header'

export function PortalNavLinks({ links }: { links: PortalNavLink[] }) {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Portal">
      {links.map((link) => {
        const active =
          link.href === '/dashboard'
            ? pathname === '/dashboard'
            : link.href === '/tasks'
              ? pathname === '/tasks' || /^\/tasks\/[^/]+$/.test(pathname)
              : pathname.startsWith(link.href)

        const Icon = link.icon

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
