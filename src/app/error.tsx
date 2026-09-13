'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Root error boundary. Shows a plain-language message — the underlying error is
 * logged, never rendered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[concierge-go] unhandled error', error.digest ?? error.message)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-subtle">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground text-pretty">
        We hit an unexpected problem. Nothing you submitted has been lost — try again, and if it
        keeps happening, contact Concierge Go operations.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  )
}
