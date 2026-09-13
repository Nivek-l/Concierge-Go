import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo size="lg" showWordmark={false} href={null} />
      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        We could not find that page
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground text-pretty">
        The link may be out of date, or the page may have moved. Everything else is still where you
        left it.
      </p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to my dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
