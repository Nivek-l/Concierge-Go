'use client'

import { useActionState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'

import { initiatePaymentAction, type InitiatePaymentResult } from '@/actions/payments'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/sonner'

export function PaymentPanel({ taskId, amountKobo }: { taskId: string; amountKobo: number }) {
  const [state, formAction, isPending] = useActionState<InitiatePaymentResult | null, FormData>(
    initiatePaymentAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      window.location.href = state.data.authorizationUrl
    } else if (state && !state.ok) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Card className="border-primary/30 bg-primary-subtle/40">
      <CardHeader>
        <CardTitle>Pay to release this task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Amount due</p>
        <p className="font-display text-3xl font-bold tracking-tight">{formatNaira(amountKobo)}</p>

        <form action={formAction}>
          <input type="hidden" name="taskId" value={taskId} />
          <Button type="submit" size="lg" className="w-full" loading={isPending}>
            Pay now
          </Button>
        </form>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Payments are verified on our server before your task is released to a Go Agent. We
          never take payment status from your browser.
        </p>
      </CardContent>
    </Card>
  )
}
