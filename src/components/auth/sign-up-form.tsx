'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

import { signUpAction, type SignUpResult } from '@/actions/auth'
import type { CityRow } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError, FormSuccess } from '@/components/shared/field'

export function SignUpForm({ cities }: { cities: CityRow[] }) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, isPending] = useActionState<SignUpResult | null, FormData>(
    signUpAction,
    null,
  )

  useEffect(() => {
    if (state?.ok && !state.data.needsConfirmation) {
      router.push('/dashboard')
      router.refresh()
    }
  }, [state, router])

  if (state?.ok) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Check your email
        </h1>
        <FormSuccess message={state.message} />
        <p className="mt-4 text-sm text-muted-foreground text-pretty">
          We sent a confirmation link to <strong>{state.data.email}</strong>. Once confirmed, sign
          in to start requesting tasks.
        </p>
        <Button asChild className="mt-6 w-full" size="lg">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Request tasks and track every step, from quote to proof.
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        <FormError message={state && !state.ok ? state.error : null} />

        <Field
          name="fullName"
          label="Full name"
          required
          error={state && !state.ok ? state.fieldErrors?.fullName : null}
        >
          {(props) => <Input {...props} name="fullName" autoComplete="name" required />}
        </Field>

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

        <Field
          name="phone"
          label="Phone number"
          required
          hint="A Nigerian number, e.g. 0803 123 4567."
          error={state && !state.ok ? state.fieldErrors?.phone : null}
        >
          {(props) => (
            <Input {...props} name="phone" type="tel" autoComplete="tel" placeholder="0803 123 4567" required />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="citySlug"
            label="City"
            required
            error={state && !state.ok ? state.fieldErrors?.citySlug : null}
          >
            {() => (
              <Select name="citySlug" defaultValue={cities[0]?.slug ?? 'calabar'}>
                <SelectTrigger id="field-citySlug">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.slug} value={city.slug} disabled={!city.is_live}>
                      {city.name}
                      {!city.is_live ? ' (coming soon)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field name="area" label="Area" hint="e.g. Marian, Calabar Municipal">
            {(props) => <Input {...props} name="area" placeholder="Your area" />}
          </Field>
        </div>

        <Field
          name="password"
          label="Password"
          required
          hint="At least 8 characters, with a letter and a number."
          error={state && !state.ok ? state.fieldErrors?.password : null}
        >
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1 flex h-8 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </Field>

        <div className="flex items-start gap-2.5 pt-1">
          <Checkbox id="acceptTerms" name="acceptTerms" required />
          <label htmlFor="acceptTerms" className="text-sm text-muted-foreground text-pretty">
            I agree that Concierge Go handles legitimate local tasks only, and accept the terms of
            use.
          </label>
        </div>
        {state && !state.ok && state.fieldErrors?.acceptTerms ? (
          <p className="text-xs font-medium text-destructive">{state.fieldErrors.acceptTerms[0]}</p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Want to work with us?{' '}
        <Link href="/sign-up/agent" className="font-medium text-primary hover:underline">
          Become a Go Agent
        </Link>
      </p>
    </div>
  )
}
