import Link from 'next/link'
import { ArrowUpRight, LogOut, Menu, User } from 'lucide-react'

import { signOutAction } from '@/actions/auth'
import { initials } from '@/lib/format'
import type { SessionUser } from '@/types/domain'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/shared/logo'
import { NotificationBell } from '@/components/shared/notification-bell'
import { PortalNavLinks } from '@/components/layout/portal-nav-links'

export interface PortalNavLink {
  href: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export function PortalHeader({
  user,
  links,
  profileHref = '/profile',
  eyebrow,
}: {
  user: SessionUser
  links: PortalNavLink[]
  profileHref?: string
  eyebrow?: string
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-16 w-full min-w-0 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Logo href={links[0]?.href ?? '/'} showWordmark={false} className="sm:hidden" />
          <Logo href={links[0]?.href ?? '/'} className="hidden sm:flex" />
          {eyebrow ? (
            <span className="hidden rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:inline-flex">
              {eyebrow}
            </span>
          ) : null}
        </div>

        <PortalNavLinks links={links} />

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NotificationBell profileId={user.id} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.profile.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{initials(user.profile.full_name)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">
                  {user.profile.full_name.split(' ')[0]}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold">{user.profile.full_name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={profileHref}>
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/">
                  <ArrowUpRight className="h-4 w-4" />
                  Visit public site
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={signOutAction} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {links.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
