import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, MapPinned, PlusCircle, Receipt } from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getCustomerDashboard } from '@/database/tasks'
import { firstName, formatFriendlyDate, formatNaira } from '@/lib/format'
import { TASK_STATUS_META } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
}

export default async function DashboardPage() {
  const user = await requireCustomer()
  const data = await getCustomerDashboard(user.id)

  const spotlight = [...data.awaitingAction, ...data.pendingQuotes, ...data.activeTasks].slice(0, 5)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Good to see you, {firstName(user.profile.full_name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here is everything happening on your Concierge Go tasks.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/tasks/new">
            <PlusCircle aria-hidden />
            Request a Task
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Active tasks" value={data.activeCount} />
        <SummaryTile label="Completed" value={data.completedCount} />
        <SummaryTile label="Total requests" value={data.totalCount} />
      </div>

      {data.pendingQuotes.length > 0 ? (
        <Card className="border-warning/30 bg-warning-subtle/40">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>
                {data.pendingQuotes.length === 1
                  ? 'A quote is ready for your decision'
                  : `${data.pendingQuotes.length} quotes are ready for your decision`}
              </CardTitle>
            </div>
            <Receipt className="h-5 w-5 text-warning" aria-hidden />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pendingQuotes.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex flex-col items-start gap-2 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.reference}</p>
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  Review quote
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Your tasks</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">
                View all
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {spotlight.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No tasks yet"
                description="When you request a task, it will show up here with its quote, agent and progress."
                action={{ label: 'Request a Task', href: '/tasks/new' }}
              />
            ) : (
              <ul className="divide-y">
                {spotlight.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/${task.id}`}
                    className="flex flex-col items-start gap-2 py-3.5 transition-colors hover:opacity-80 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{task.title}</p>
                          <UrgencyBadge urgency={task.urgency} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {task.reference} · {task.category_name} ·{' '}
                          {formatFriendlyDate(task.preferred_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                        <TaskStatusBadge status={task.status} />
                        {['en_route', 'arrived', 'in_progress'].includes(task.status) ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                            <MapPinned className="h-3.5 w-3.5" aria-hidden />
                            Track Go Agent
                          </span>
                        ) : null}
                        {task.total_kobo ? (
                          <span className="text-xs text-muted-foreground">
                            {formatNaira(task.total_kobo)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Activity on your tasks will appear here.
              </p>
            ) : (
              <ol className="space-y-4">
                {data.recentActivity.map((entry) => {
                  const meta = TASK_STATUS_META[entry.status]
                  return (
                    <li key={entry.id} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <Link
                          href={`/tasks/${entry.taskId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {entry.taskTitle}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {meta.label} · {formatFriendlyDate(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 font-display text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}
