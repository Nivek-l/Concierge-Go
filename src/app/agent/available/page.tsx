import type { Metadata } from 'next'
import { Briefcase } from 'lucide-react'

import { requireAgent } from '@/lib/auth'
import { getAvailableTasks } from '@/database/agents'
import { formatFriendlyDate, formatNaira } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { UrgencyBadge } from '@/components/shared/status-badge'
import { AcceptTaskButton } from '@/components/agent/accept-task-button'

export const metadata: Metadata = {
  title: 'Available tasks',
  robots: { index: false, follow: false },
}

export default async function AvailableTasksPage() {
  const user = await requireAgent()
  const tasks = user.agent.verification_status === 'verified' ? await getAvailableTasks() : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Available tasks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a task that fits your area and schedule. First to accept gets it.
        </p>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No tasks available right now"
          description="Check back soon — new tasks appear here once operations reviews and prices them."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{task.title}</p>
                    <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {task.reference} · {task.category_name}
                    </p>
                  </div>
                  <UrgencyBadge urgency={task.urgency} />
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">
                  {task.summary}
                </p>
                <dl className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex min-w-0 flex-wrap justify-between gap-2">
                    <dt>Area</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-foreground [overflow-wrap:anywhere]">
                      {task.location_area ?? task.city_name ?? 'Calabar'}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-wrap justify-between gap-2">
                    <dt>Timing</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-foreground [overflow-wrap:anywhere]">
                      {task.preferred_date ? formatFriendlyDate(task.preferred_date) : 'Flexible'}
                      {task.preferred_time_slot ? ` · ${task.preferred_time_slot}` : ''}
                    </dd>
                  </div>
                  {task.destination_required ? (
                    <div className="flex min-w-0 flex-wrap justify-between gap-2">
                      <dt>Delivery</dt>
                      <dd className="break-words text-right font-medium text-foreground">Second stop required</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="font-display text-lg font-bold tracking-tight">
                    {formatNaira(task.agent_payout_kobo)}
                  </span>
                  <AcceptTaskButton taskId={task.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
