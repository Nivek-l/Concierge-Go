import Link from 'next/link'
import { Bell } from 'lucide-react'

import { getNotifications, getUnreadNotificationCount } from '@/database/profile'
import { formatRelative } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Server component: reads the current user's latest notifications each render. */
export async function NotificationBell({ profileId }: { profileId: string }) {
  const [unread, notifications] = await Promise.all([
    getUnreadNotificationCount(profileId),
    getNotifications(profileId, { limit: 6 }),
  ])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell aria-hidden />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-accent" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Badge variant="progress">{unread} new</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">You&apos;re all caught up</span>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing here yet. Updates on your tasks will show up in this list.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notification.link ?? '/notifications'}
                  className="block px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <p className="text-sm font-medium leading-snug">
                    {!notification.read_at ? (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                    ) : null}
                    {notification.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelative(notification.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
