import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPinned, Route } from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getCustomerDashboard } from '@/database/tasks'
import { TASK_STATUS_META } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge } from '@/components/shared/status-badge'

export const metadata: Metadata = {
  title: 'Track tasks',
  robots: { index: false, follow: false },
}

export default async function TrackPage() {
  const user = await requireCustomer()
  const data = await getCustomerDashboard(user.id)
  const tasks = data.activeTasks

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Live work
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Track your tasks
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Open an active task to see its current journey, Go Agent location when available, messages and proof.
        </p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="Nothing to track right now"
          description="Tasks appear here after they are paid and move into active fulfilment."
          action={{ label: 'View my tasks', href: '/tasks' }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => {
            const meta = TASK_STATUS_META[task.status]
            return (
              <Link key={task.id} href={`/tasks/${task.id}`} className="group">
                <Card className="h-full transition-all group-hover:border-primary/30 group-hover:shadow-lift">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                          <Route className="h-4 w-4" aria-hidden />
                          Active task
                        </div>
                        <h2 className="mt-2 truncate font-display text-lg font-bold">{task.title}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{task.reference}</p>
                      </div>
                      <TaskStatusBadge status={task.status} />
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium">{meta.customerHeadline}</span>
                        <span className="shrink-0 text-muted-foreground">{meta.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${meta.progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
                      <span className="text-muted-foreground">Open journey</span>
                      <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
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
