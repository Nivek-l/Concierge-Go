import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { getNotifications } from '@/database/profile'
import { NotificationsList } from '@/components/shared/notifications-list'

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
}

export default async function NotificationsPage() {
  const user = await requireUser()
  const notifications = await getNotifications(user.id, { limit: 50 })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Notifications
      </h1>
      <NotificationsList notifications={notifications} />
    </div>
  )
}
