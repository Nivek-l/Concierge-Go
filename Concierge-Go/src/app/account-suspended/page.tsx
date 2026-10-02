import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { getSessionUser } from '@/lib/auth'
import { publicEnv } from '@/lib/env'
import { formatPhone } from '@/lib/format'
import { signOutAction } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'

export const metadata: Metadata = {
  title: 'Account suspended',
  robots: { index: false, follow: false },
}

export default async function AccountSuspendedPage() {
  const user = await getSessionUser()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo size="lg" showWordmark={false} href={null} />
      <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-subtle">
        <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Your account is suspended
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground text-pretty">
        {user?.profile.suspension_reason ??
          'Contact Concierge Go operations to find out more and restore access.'}
      </p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <a href={`mailto:${publicEnv.supportEmail}`}>Email operations</a>
        </Button>
        <Button asChild variant="outline">
          <a href={`tel:${publicEnv.supportPhone}`}>Call {formatPhone(publicEnv.supportPhone)}</a>
        </Button>
      </div>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
      <Link href="/" className="mt-2 text-xs text-muted-foreground hover:text-foreground">
        Back to home
      </Link>
    </main>
  )
}
