import { Check } from 'lucide-react'

import { TASK_STATUS_META } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TaskStatus, TaskStatusHistoryRow } from '@/types/database'

const MILESTONE_ORDER: TaskStatus[] = [
  'submitted',
  'under_review',
  'quoted',
  'awaiting_payment',
  'paid',
  'assigned',
  'in_progress',
  'awaiting_confirmation',
  'completed',
]

export function TaskTimeline({
  status,
  history,
}: {
  status: TaskStatus
  history: TaskStatusHistoryRow[]
}) {
  const reachedAt = new Map<TaskStatus, string>()
  for (const entry of history) {
    if (!reachedAt.has(entry.to_status)) reachedAt.set(entry.to_status, entry.created_at)
  }

  if (status === 'cancelled' || status === 'disputed') {
    return (
      <ol className="space-y-4">
        {history.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-medium">{TASK_STATUS_META[entry.to_status].label}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
              {entry.note ? (
                <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{entry.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    )
  }

  const currentIndex = MILESTONE_ORDER.indexOf(status)

  return (
    <ol className="space-y-0">
      {MILESTONE_ORDER.map((milestone, index) => {
        const done = reachedAt.has(milestone) || (currentIndex >= 0 && index < currentIndex)
        const isCurrent = milestone === status
        const timestamp = reachedAt.get(milestone)
        const isLast = index === MILESTONE_ORDER.length - 1

        return (
          <li key={milestone} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  'absolute left-[9px] top-5 h-full w-px',
                  done ? 'bg-primary' : 'bg-border',
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isCurrent
                    ? 'border-primary bg-background'
                    : 'border-border bg-background',
              )}
            >
              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <div>
              <p
                className={cn(
                  'text-sm font-medium',
                  !done && !isCurrent && 'text-muted-foreground',
                )}
              >
                {TASK_STATUS_META[milestone].label}
              </p>
              {timestamp ? (
                <p className="text-xs text-muted-foreground">{formatDateTime(timestamp)}</p>
              ) : isCurrent ? (
                <p className="text-xs font-medium text-primary">In progress</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
