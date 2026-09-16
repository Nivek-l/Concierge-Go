import {
  DISPUTE_STATUS_META,
  PAYMENT_STATUS_META,
  QUOTE_STATUS_META,
  TASK_STATUS_META,
  URGENCY_META,
  VERIFICATION_STATUS_META,
  type StatusTone,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type {
  DisputeStatus,
  PaymentStatus,
  QuoteStatus,
  TaskStatus,
  TaskUrgency,
  VerificationStatus,
} from '@/types/database'

/**
 * Status display.
 *
 * The application never prints a raw database value. Every status becomes a
 * human sentence via the metadata in lib/constants, and every tone maps to one
 * badge variant so colour means the same thing everywhere.
 */

const TONE_TO_VARIANT: Record<StatusTone, 'neutral' | 'info' | 'progress' | 'warning' | 'success' | 'danger'> = {
  neutral: 'neutral',
  info: 'info',
  progress: 'progress',
  warning: 'warning',
  success: 'success',
  danger: 'danger',
}

const TONE_DOT: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-info',
  progress: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
  danger: 'bg-destructive',
}

interface TaskStatusBadgeProps {
  status: TaskStatus
  /** Agent surfaces use the agent-facing wording. */
  perspective?: 'customer' | 'agent' | 'admin'
  showDot?: boolean
  className?: string
}

export function TaskStatusBadge({
  status,
  perspective = 'customer',
  showDot = true,
  className,
}: TaskStatusBadgeProps) {
  const meta = TASK_STATUS_META[status]
  const label = perspective === 'agent' ? meta.agentLabel : meta.label
  const isLive = ['en_route', 'arrived', 'in_progress'].includes(status)

  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={className}>
      {showDot ? (
        <span className="relative flex h-1.5 w-1.5">
          {isLive ? (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                TONE_DOT[meta.tone],
              )}
            />
          ) : null}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', TONE_DOT[meta.tone])} />
        </span>
      ) : null}
      {label}
    </Badge>
  )
}

export function UrgencyBadge({ urgency, className }: { urgency: TaskUrgency; className?: string }) {
  const meta = URGENCY_META[urgency]
  if (urgency === 'standard') return null
  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={className}>
      {meta.label}
    </Badge>
  )
}

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  const meta = QUOTE_STATUS_META[status]
  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={className}>
      {meta.label}
    </Badge>
  )
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus
  className?: string
}) {
  const meta = PAYMENT_STATUS_META[status]
  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={className}>
      {meta.label}
    </Badge>
  )
}

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus
  className?: string
}) {
  const meta = VERIFICATION_STATUS_META[status]
  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={className}>
      {meta.label}
    </Badge>
  )
}

export function DisputeStatusBadge({
  status,
  className,
}: {
  status: DisputeStatus
  className?: string
}) {
  const meta = DISPUTE_STATUS_META[status]
  return (
    <Badge variant={TONE_TO_VARIANT[meta.tone]} className={className}>
      {meta.label}
    </Badge>
  )
}

/**
 * The "what is happening / what happens next" block. This is the answer to the
 * customer's two most common questions, so it appears at the top of every task.
 */
export function StatusExplainer({
  status,
  perspective = 'customer',
  className,
}: {
  status: TaskStatus
  perspective?: 'customer' | 'agent' | 'admin'
  className?: string
}) {
  const meta = TASK_STATUS_META[status]
  const content =
    perspective === 'admin'
      ? { headline: meta.adminHeadline, next: meta.adminNext }
      : perspective === 'agent'
        ? { headline: meta.agentHeadline, next: meta.agentNext }
        : { headline: meta.customerHeadline, next: meta.customerNext }

  const toneClasses: Record<StatusTone, string> = {
    neutral: 'border-border bg-muted/50',
    info: 'border-info/20 bg-info-subtle',
    progress: 'border-primary/20 bg-primary-subtle',
    warning: 'border-warning/25 bg-warning-subtle',
    success: 'border-success/20 bg-success-subtle',
    danger: 'border-destructive/25 bg-destructive-subtle',
  }

  return (
    <div className={cn('rounded-xl border p-4 sm:p-5', toneClasses[meta.tone], className)}>
      <p className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {content.headline}
      </p>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{content.next}</p>
    </div>
  )
}
