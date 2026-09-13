'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

import { signInAction, type SignInResult } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormError } from '@/components/shared/field'
import { toast } from '@/components/ui/sonner'

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, isPending] = useActionState<SignInResult | null, FormData>(
    signInAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success('Signed in')
      router.push(state.data.redirectTo)
      router.refresh()
    }
  }, [state, router])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to track your tasks and manage your requests.
      </p>

      <form action={formAction} className="mt-7 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <FormError message={state && !state.ok ? state.error : null} />

        <Field
          name="email"
          label="Email"
          required
          error={state && !state.ok ? state.fieldErrors?.email : null}
        >
          {(props) => (
            <Input
              {...props}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
            />
          )}
        </Field>

        <Field
          name="password"
          label="Password"
          required
          error={state && !state.ok ? state.fieldErrors?.password : null}
        >
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-1 top-1 flex h-8 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Concierge Go?{' '}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Create an account
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
