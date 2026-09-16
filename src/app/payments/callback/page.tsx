import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'
import { ERROR_MESSAGES, logError, toUserMessage } from '@/lib/errors'
import { formatNaira } from '@/lib/format'
import {
  verifyAndRecordPayment,
  type PaymentVerificationData,
} from '@/services/payments/reconcile'
import { verifyPaymentSchema } from '@/lib/validations'

export const metadata: Metadata = {
  title: 'Payment status',
  robots: { index: false, follow: false },
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? '').trim()
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
  const reference = firstValue(params.reference ?? params.trxref)
  const parsed = verifyPaymentSchema.safeParse({ reference })

  if (!parsed.success) {
    return (
      <CallbackShell>
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Missing payment reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not find a valid payment reference in this link.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </CallbackShell>
    )
  }

  let result: PaymentVerificationData | null = null
  let errorMessage: string | null = null

  try {
    // Provider verification is authoritative and does not depend on the
    // browser session. This is important when a customer returns through a
    // different Vercel alias or their auth cookie has expired during checkout.
    result = await verifyAndRecordPayment(parsed.data.reference)
  } catch (error) {
    logError('payments.callback', error, { reference: parsed.data.reference })
    errorMessage = toUserMessage(error, ERROR_MESSAGES.paymentFailed)
  }

  if (result?.status === 'succeeded') {
    return (
      <CallbackShell>
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Payment received</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatNaira(result.amountKobo)} confirmed. We are assigning a Go Agent to your task.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/tasks/${result.taskId}`}>View task</Link>
        </Button>
      </CallbackShell>
    )
  }

  if (result?.status === 'pending') {
    return (
      <CallbackShell>
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Confirming your payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paystack has not confirmed it yet. Refresh shortly, or check your task page.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/tasks/${result.taskId}`}>View task</Link>
        </Button>
      </CallbackShell>
    )
  }

  return (
    <CallbackShell>
      <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
      <h1 className="mt-4 text-lg font-semibold">Payment could not be confirmed</h1>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">
        {errorMessage ?? 'Paystack did not report a successful payment. Please try again or contact operations.'}
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href={result ? `/tasks/${result.taskId}` : '/dashboard'}>
          {result ? 'View task' : 'Go to dashboard'}
        </Link>
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
