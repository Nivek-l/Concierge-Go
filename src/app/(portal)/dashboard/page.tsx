import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ClipboardList,
  FileText,
  House,
  MapPinned,
  PackageCheck,
  PlusCircle,
  Receipt,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getCustomerDashboard } from '@/database/tasks'
import { firstName, formatFriendlyDate, formatNaira } from '@/lib/format'
import { TASK_STATUS_META } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'

const POPULAR_REQUESTS = [
  {
    label: 'Groceries',
    description: 'Shopping and delivery',
    category: 'shopping-sourcing',
    icon: ShoppingBasket,
  },
  {
    label: 'Documents',
    description: 'Submit or collect',
    category: 'documents-administration',
    icon: FileText,
  },
  {
    label: 'Pickup',
    description: 'Collect and deliver',
    category: 'personal-errands',
    icon: PackageCheck,
  },
  {
    label: 'Inspection',
    description: 'On-site checks',
    category: 'property-verification',
    icon: House,
  },
] as const

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
      <section className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Concierge Go</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Good to see you, {firstName(user.profile.full_name)}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Request what you need, follow each stage, and keep every quote and update in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/tasks/ai"><Sparkles aria-hidden />Ask Concierge AI</Link></Button>
            <Button asChild><Link href="/tasks/new"><PlusCircle aria-hidden />New Task</Link></Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="popular-requests-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick start</p>
            <h2 id="popular-requests-heading" className="mt-1 text-lg font-bold sm:text-xl">
              Popular requests
            </h2>
          </div>
          <Link
            href="/tasks/new"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary hover:underline"
          >
            See all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {POPULAR_REQUESTS.map((request) => {
            const Icon = request.icon
            return (
              <Link
                key={request.label}
                href={`/tasks/new?mode=manual&category=${request.category}`}
                className="group min-w-0 rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5"
              >
                <span className="inline-flex rounded-xl bg-primary-subtle p-2.5 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="mt-4 block break-words text-sm font-bold sm:text-base">{request.label}</span>
                <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                  {request.description}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
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
                className="flex min-w-0 flex-col items-start gap-2 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 max-w-full">
                  <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{task.title}</p>
                  <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{task.reference}</p>
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
                    className="flex min-w-0 flex-col items-start gap-2 py-3.5 transition-colors hover:opacity-80 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="w-full min-w-0 sm:flex-1">
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <p className="min-w-0 break-words text-sm font-semibold [overflow-wrap:anywhere] sm:truncate">{task.title}</p>
                          <UrgencyBadge urgency={task.urgency} />
                        </div>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {task.reference} · {task.category_name} ·{' '}
                          {formatFriendlyDate(task.preferred_date)}
                        </p>
                      </div>
                      <div className="flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:justify-start sm:gap-1">
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
    <Card className="overflow-hidden">
      <CardContent className="relative pt-5 sm:pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 font-display text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}
