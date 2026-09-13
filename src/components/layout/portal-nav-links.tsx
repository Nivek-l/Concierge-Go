'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { PortalNavLink } from '@/components/layout/portal-header'

export function PortalNavLinks({ links }: { links: PortalNavLink[] }) {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Portal">
      {links.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
