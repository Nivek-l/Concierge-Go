import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; href: string }
  secondaryAction?: { label: string; href: string }
  className?: string
}

/**
 * Empty state. Always says what would fill this space and how to get there —
 * never just "No results".
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {action ? (
            <Button asChild size="sm">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button asChild size="sm" variant="outline">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  /** Client components can pass a retry handler; server pages pass a link. */
  onRetry?: () => void
  retryHref?: string
  className?: string
}

/**
 * Error state. Says what failed in plain language — the underlying error is
 * logged server-side and never shown.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. Please try again in a moment.',
  onRetry,
  retryHref,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive-subtle px-6 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-5">
          <RefreshCw aria-hidden />
          Try again
        </Button>
      ) : retryHref ? (
        <Button asChild size="sm" variant="outline" className="mt-5">
          <Link href={retryHref}>Try again</Link>
        </Button>
      ) : null}
    </div>
  )
}

/** Inline warning strip for non-blocking problems. */
export function InlineNotice({
  tone = 'warning',
  children,
  className,
}: {
  tone?: 'warning' | 'info' | 'danger' | 'success'
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    warning: 'border-warning/25 bg-warning-subtle text-foreground',
    info: 'border-info/20 bg-info-subtle text-foreground',
    danger: 'border-destructive/25 bg-destructive-subtle text-foreground',
    success: 'border-success/20 bg-success-subtle text-foreground',
  }

  return (
    <div className={cn('rounded-lg border px-3.5 py-3 text-sm text-pretty', tones[tone], className)}>
      {children}
    </div>
  )
}
