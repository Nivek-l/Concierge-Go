import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { verifyPaymentAction } from '@/actions/payments'
import { requireUser } from '@/lib/auth'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'

export const metadata: Metadata = {
  title: 'Payment status',
  robots: { index: false, follow: false },
}

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    reference?: string | string[]
    trxref?: string | string[]
  }>
}) {
  const params = await searchParams

const getFirstValue = (
  value: string | string[] | undefined,
): string => {
  return Array.isArray(value)
    ? value[0] ?? ''
    : value ?? ''
}

const reference = getFirstValue(
  params.reference ?? params.trxref,
).trim()
  
  await requireUser()

  if (!reference) {
    return (
      <CallbackShell>
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Missing payment reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not find a payment reference in this link.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </CallbackShell>
    )
  }

  const result = await verifyPaymentAction(reference)

  if (result.ok && result.data.status === 'succeeded') {
    return (
      <CallbackShell>
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Payment received</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNaira(result.data.amountKobo)} confirmed. We are assigning a Go Agent to your
          task.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/tasks/${result.data.taskId}`}>View task</Link>
        </Button>
      </CallbackShell>
    )
  }

  if (result.ok && result.data.status === 'pending') {
    return (
      <CallbackShell>
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Confirming your payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is taking a moment. Refresh in a minute, or check your task page.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/tasks/${result.data.taskId}`}>View task</Link>
        </Button>
      </CallbackShell>
    )
  }

  return (
    <CallbackShell>
      <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold">Payment could not be confirmed</h1>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">
        {!result.ok ? result.error : 'Please try again or contact operations.'}
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </CallbackShell>
  )
}

function CallbackShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo href={null} showWordmark={false} size="sm" />
      <div className="mt-6 flex flex-col items-center">{children}</div>
    </main>
  )
}
