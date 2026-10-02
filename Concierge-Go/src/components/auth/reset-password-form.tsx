'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { resetPasswordAction, type ResetPasswordResult } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormError } from '@/components/shared/field'
import { toast } from '@/components/ui/sonner'

export function ResetPasswordForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<ResetPasswordResult | null, FormData>(
    resetPasswordAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message)
      router.push('/sign-in')
    }
  }, [state, router])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Set a new password for your Concierge Go account.
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        <FormError message={state && !state.ok ? state.error : null} />

        <Field
          name="password"
          label="New password"
          required
          hint="At least 8 characters, with a letter and a number."
          error={state && !state.ok ? state.fieldErrors?.password : null}
        >
          {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" required />}
        </Field>

        <Field
          name="confirmPassword"
          label="Confirm new password"
          required
          error={state && !state.ok ? state.fieldErrors?.confirmPassword : null}
        >
          {(props) => (
            <Input {...props} name="confirmPassword" type="password" autoComplete="new-password" required />
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Update password
        </Button>
      </form>
    </div>
  )
}
