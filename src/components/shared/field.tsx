'use client'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/**
 * Form field wrapper.
 *
 * Wires the label, hint and error message to the control with the right aria
 * attributes, so every form in the application is accessible by construction
 * rather than by remembering.
 */
interface FieldProps {
  name: string
  label: string
  hint?: string
  error?: string[] | string | null
  required?: boolean
  className?: string
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => React.ReactNode
}

export function Field({
  name,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const id = `field-${name}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const message = Array.isArray(error) ? error[0] : error
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">Optional</span>
        )}
      </Label>

      {children({
        id,
        'aria-invalid': Boolean(message),
        'aria-describedby': describedBy,
      })}

      {hint && !message ? (
        <p id={hintId} className="text-xs text-muted-foreground text-pretty">
          {hint}
        </p>
      ) : null}

      {message ? (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  )
}

/** Top-of-form error summary for failures that are not field-specific. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      className="rounded-lg border border-destructive/25 bg-destructive-subtle px-3.5 py-3 text-sm text-pretty"
      role="alert"
    >
      {message}
    </div>
  )
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-success/25 bg-success-subtle px-3.5 py-3 text-sm text-pretty">
      {message}
    </div>
  )
}
