'use client'

import { useActionState } from 'react'

import { submitVerificationAction, type VerificationResult } from '@/actions/agent'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormError, FormSuccess } from '@/components/shared/field'

export function VerificationForm({ defaultTransportMode }: { defaultTransportMode: string | null }) {
  const [state, formAction, isPending] = useActionState<VerificationResult | null, FormData>(
    submitVerificationAction,
    null,
  )

  if (state?.ok) {
    return <FormSuccess message={state.message} />
  }

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state && !state.ok ? state.error : null} />

      <Field
        name="transportMode"
        label="How do you get around?"
        required
        hint="e.g. Motorcycle, keke napep, car, on foot"
        error={fieldErrors?.transportMode}
      >
        {(props) => (
          <Input {...props} name="transportMode" defaultValue={defaultTransportMode ?? ''} required />
        )}
      </Field>

      <Field
        name="availability"
        label="When are you generally available?"
        required
        error={fieldErrors?.availability}
      >
        {(props) => (
          <Textarea
            {...props}
            name="availability"
            rows={2}
            placeholder="e.g. Weekdays 8am–6pm, some weekends"
            required
          />
        )}
      </Field>

      <Field name="experience" label="Relevant experience" hint="Optional">
        {(props) => (
          <Textarea {...props} name="experience" rows={3} placeholder="Errands, delivery, admin work, sales…" />
        )}
      </Field>

      <Field name="motivation" label="Why do you want to be a Go Agent?" hint="Optional">
        {(props) => <Textarea {...props} name="motivation" rows={2} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="refereeName" label="A referee's name" hint="Optional">
          {(props) => <Input {...props} name="refereeName" />}
        </Field>
        <Field
          name="refereePhone"
          label="Referee's phone"
          hint="Optional"
          error={fieldErrors?.refereePhone}
        >
          {(props) => <Input {...props} name="refereePhone" type="tel" placeholder="0803 123 4567" />}
        </Field>
      </div>

      <div className="flex items-start gap-2.5 pt-1">
        <Checkbox id="consentsToChecks" name="consentsToChecks" required />
        <label htmlFor="consentsToChecks" className="text-sm text-muted-foreground text-pretty">
          I consent to Concierge Go operations verifying the information above before I can accept
          tasks.
        </label>
      </div>
      {fieldErrors?.consentsToChecks ? (
        <p className="text-xs font-medium text-destructive">{fieldErrors.consentsToChecks[0]}</p>
      ) : null}

      <Button type="submit" size="lg" loading={isPending}>
        Submit for review
      </Button>
    </form>
  )
}
