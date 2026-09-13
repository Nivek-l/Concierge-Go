'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { forgotPasswordAction, type ForgotPasswordResult } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormError, FormSuccess } from '@/components/shared/field'

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<ForgotPasswordResult | null, FormData>(
    forgotPasswordAction,
    null,
  )

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Enter the email on your account and we&apos;ll send a link to reset your password.
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        <FormError message={state && !state.ok ? state.error : null} />
        <FormSuccess message={state?.ok ? state.message : null} />

        <Field
          name="email"
          label="Email"
          required
          error={state && !state.ok ? state.fieldErrors?.email : null}
        >
          {(props) => (
            <Input {...props} name="email" type="email" autoComplete="email" required />
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered your password?{' '}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
