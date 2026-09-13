import {
  BadgeCheck,
  CheckCheck,
  CreditCard,
  PenLine,
  Receipt,
  Route,
  type LucideIcon,
} from 'lucide-react'

import { WORKFLOW_STEPS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  PenLine,
  Receipt,
  CreditCard,
  Route,
  BadgeCheck,
  CheckCheck,
}

/**
 * Request → Quote → Pay → Track → Proof → Done.
 *
 * Rendered as a connected sequence rather than six cards, because the point is
 * that these steps follow one another.
 */
export function WorkflowSteps({ className }: { className?: string }) {
  return (
    <ol className={cn('grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {WORKFLOW_STEPS.map((step, index) => {
        const Icon = ICONS[step.icon] ?? PenLine
        const isLast = index === WORKFLOW_STEPS.length - 1

        return (
          <li key={step.key} className="relative">
            {/* Connector line, hidden on the last item and on small screens. */}
            {!isLast ? (
              <span
                className="absolute left-5 top-11 hidden h-[calc(100%-1rem)] w-px bg-border sm:block lg:hidden"
                aria-hidden
              />
            ) : null}

            <div className="flex items-start gap-4">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card shadow-soft">
                <Icon className="h-4.5 w-4.5 text-primary" aria-hidden />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {index + 1}
                </span>
              </div>

              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {step.label}
                </p>
                <h3 className="mt-1 font-display text-base font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{step.body}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Compact horizontal version for the hero. */
export function WorkflowStrip({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm', className)}>
      {WORKFLOW_STEPS.map((step, index) => (
        <span key={step.key} className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{step.label}</span>
          {index < WORKFLOW_STEPS.length - 1 ? (
            <span className="text-muted-foreground/60" aria-hidden>
              →
            </span>
          ) : null}
        </span>
      ))}
    </div>
  )
}
