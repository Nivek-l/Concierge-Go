import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPinned } from 'lucide-react'
import { requireCustomer } from '@/lib/auth'
import { getCustomerDashboard } from '@/database/tasks'
import { TASK_STATUS_META } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge } from '@/components/shared/status-badge'

export const metadata: Metadata = { title: 'Track Tasks', robots: { index: false, follow: false } }
export default async function TrackPage() {
  const user = await requireCustomer()
  const data = await getCustomerDashboard(user.id)
  const trackable = data.activeTasks.filter((task) =>
    ['assigned', 'en_route', 'arrived', 'in_progress'].includes(task.status),
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Live journeys</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Track your tasks</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          See the current stage first. Open a task for its live map when your Go Agent is sharing location.
        </p>
      </div>

      {trackable.length === 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <EmptyState
              icon={MapPinned}
              title="Nothing to track right now"
              description="Assigned and in-progress tasks will appear here automatically."
              action={{ label: 'View my tasks', href: '/tasks' }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trackable.map((task) => {
            const meta = TASK_STATUS_META[task.status]
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="transition group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:border-primary/40">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                      <div className="min-w-0 max-w-full">
                        <p className="break-words font-semibold [overflow-wrap:anywhere]">{task.title}</p>
                        <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {task.reference} · {task.location_area ?? task.city_name ?? 'Task location'}
                        </p>
                      </div>
                      <TaskStatusBadge status={task.status} />
                    </div>
                    <div
                      className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`${meta.label} progress`}
                      aria-valuenow={meta.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${meta.progress}%` }} />
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-xs min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                      <span className="font-medium text-muted-foreground">{meta.label}</span>
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        Open tracking <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
