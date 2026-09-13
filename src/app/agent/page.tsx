import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Briefcase, CheckCircle2, ClipboardList, Star, Wallet } from 'lucide-react'

import { requireAgent } from '@/lib/auth'
import { getAgentStats, getAgentTasks } from '@/database/agents'
import { firstName, formatFriendlyDate, formatNaira } from '@/lib/format'
import { AGENT_ACTION_LABEL } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge } from '@/components/shared/status-badge'
import { AvailabilityToggle } from '@/components/agent/availability-toggle'

export const metadata: Metadata = {
  title: 'Agent dashboard',
  robots: { index: false, follow: false },
}

export default async function AgentDashboardPage() {
  const user = await requireAgent()
  const [stats, activeTasks] = await Promise.all([
    getAgentStats(),
    getAgentTasks(user.agent.id, { assignmentStatuses: ['active'] }),
  ])

  if (user.agent.verification_status !== 'verified') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-10 text-center">
          <Briefcase className="h-8 w-8 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 font-display text-xl font-bold tracking-tight">
            {user.agent.verification_status === 'pending'
              ? 'Your verification is under review'
              : user.agent.verification_status === 'rejected'
                ? 'Your verification needs another look'
                : 'Complete your verification'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {user.agent.verification_status === 'pending'
              ? 'Operations is reviewing your details. This usually takes a short while — check back soon.'
              : 'Verified Go Agents get access to available tasks. Tell us a bit about how you work to get started.'}
          </p>
          <Button asChild className="mt-6">
            <Link href="/agent/verification">
              {user.agent.verification_status === 'pending' ? 'View submission' : 'Start verification'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {firstName(user.profile.full_name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here is your day at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <AvailabilityToggle initialValue={user.agent.is_available} />
          <Button asChild>
            <Link href="/agent/available">
              Find tasks
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Active tasks"
          value={String(stats?.active_tasks ?? activeTasks.length)}
        />
        <StatCard icon={CheckCircle2} label="Completed" value={String(stats?.completed_tasks ?? 0)} />
        <StatCard
          icon={Wallet}
          label="Earned"
          value={formatNaira(stats?.earnings_kobo ?? 0)}
          sub={stats?.pending_earnings_kobo ? `${formatNaira(stats.pending_earnings_kobo)} pending` : undefined}
        />
        <StatCard
          icon={Star}
          label="Rating"
          value={stats ? stats.rating.toFixed(1) : '—'}
          sub={stats ? `${stats.rating_count} reviews` : undefined}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Your active tasks</CardTitle>
          <Badge variant="info">{stats?.available_tasks ?? 0} open on the job board</Badge>
        </CardHeader>
        <CardContent>
          {activeTasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No active tasks"
              description="Browse the job board to pick up your next task."
              action={{ label: 'View available tasks', href: '/agent/available' }}
            />
          ) : (
            <ul className="divide-y">
              {activeTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/agent/tasks/${task.id}`}
                    className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.reference} · {task.category_name}
                        {task.location_area ? ` · ${task.location_area}` : ''} ·{' '}
                        {formatFriendlyDate(task.preferred_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <TaskStatusBadge status={task.status} />
                      {AGENT_ACTION_LABEL[task.status] ? (
                        <span className="text-xs font-medium text-primary">
                          {AGENT_ACTION_LABEL[task.status]}
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
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </div>
        <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}
