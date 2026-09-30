import Link from 'next/link'
import { LogOut, Menu, User } from 'lucide-react'

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
import { PortalSearch } from '@/components/layout/portal-search'
import { RealtimeRefresh } from '@/components/shared/realtime-refresh'
import { PushNotificationManager } from '@/components/shared/push-notification-manager'

export interface PortalNavLink {
  href: string
  label: string
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
  const isCustomer = links.some((link) => link.href === '/dashboard')
  const isAgent = links.some((link) => link.href === '/agent')
  const searchBase = isCustomer ? '/tasks' : isAgent ? '/agent/available' : '/admin/tasks'
  const searchPlaceholder = isCustomer
    ? 'Search your tasks…'
    : isAgent
      ? 'Search available tasks…'
      : 'Search operations…'

  return (
    <>
      <RealtimeRefresh profileId={user.id} />

      <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="container flex min-h-16 w-full min-w-0 flex-wrap items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <Logo
              href={links[0]?.href ?? '/'}
              showWordmark={false}
              className="sm:hidden"
            />
            <Logo href={links[0]?.href ?? '/'} className="hidden sm:flex" />
            {eyebrow ? (
              <span className="hidden rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:inline-flex">
                {eyebrow}
              </span>
            ) : null}
          </div>

          <PortalNavLinks links={links} />

          <div className="ml-auto hidden min-w-0 flex-1 justify-end md:flex lg:max-w-sm">
            <PortalSearch basePath={searchBase} placeholder={searchPlaceholder} />
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-1 md:ml-0">
            <PushNotificationManager />
            <NotificationBell profileId={user.id} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full p-0.5 pr-1 transition hover:bg-muted sm:pr-2"
                  aria-label="Account menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.profile.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials(user.profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[7rem] truncate text-sm font-medium sm:inline">
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
                    Profile & settings
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

            {!isCustomer && !isAgent ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                    <Menu />
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
            ) : null}
          </div>

          <div className="order-last w-full basis-full md:hidden">
            <PortalSearch basePath={searchBase} placeholder={searchPlaceholder} />
          </div>
        </div>
      </header>
    </>
  )
}
