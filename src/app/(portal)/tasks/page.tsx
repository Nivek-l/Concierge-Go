import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList, PlusCircle } from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getTasksForCustomer } from '@/database/tasks'
import { formatFriendlyDate, formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'

export const metadata: Metadata = {
  title: 'My tasks',
  robots: { index: false, follow: false },
}

export default async function TasksListPage() {
  const user = await requireCustomer()
  const tasks = (await getTasksForCustomer(user.id)).filter((task) => task.status !== 'draft')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            My tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every request you have made, and where it stands.
          </p>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <PlusCircle aria-hidden />
            Request a Task
          </Link>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks yet"
          description="Describe what you need done and Concierge Go will review it and send you a quote."
          action={{ label: 'Request a Task', href: '/tasks/new' }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{task.title}</p>
                        <UrgencyBadge urgency={task.urgency} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.reference} · {task.category_name}
                        {task.location_area ? ` · ${task.location_area}` : ''} ·{' '}
                        {formatFriendlyDate(task.preferred_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <TaskStatusBadge status={task.status} />
                      {task.total_kobo ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatNaira(task.total_kobo)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
