'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Bell, CheckCheck } from 'lucide-react'

import { markAllNotificationsReadAction, markNotificationReadAction } from '@/actions/profile'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import type { NotificationRow } from '@/types/database'

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const unreadCount = notifications.filter((n) => !n.read_at).length

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction()
      router.refresh()
    })
  }

  function openNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      startTransition(async () => {
        await markNotificationReadAction(notification.id)
        router.refresh()
      })
    }
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="Updates on your tasks will appear here."
      />
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" loading={isPending} onClick={markAll}>
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all as read
          </Button>
        </div>
      ) : null}

      <ul className="divide-y rounded-xl border bg-card">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <Link
              href={notification.link ?? '#'}
              onClick={() => openNotification(notification)}
              className={cn(
                'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50',
                !notification.read_at && 'bg-primary-subtle/40',
              )}
            >
              {!notification.read_at ? (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              ) : (
                <span className="mt-1.5 h-2 w-2 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                  {notification.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelative(notification.created_at)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
