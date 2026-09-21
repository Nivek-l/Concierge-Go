'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createQuoteAction, type CreateQuoteResult } from '@/actions/admin'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormError } from '@/components/shared/field'
import { toast } from '@/components/ui/sonner'

function toKobo(nairaValue: string) {
  const n = Number(nairaValue)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function QuoteForm({
  taskId,
  suggested,
}: {
  taskId: string
  suggested?: { serviceFeeNaira: number; serviceChargeNaira: number }
}) {
  const router = useRouter()
  const [serviceFee, setServiceFee] = useState(String(suggested?.serviceFeeNaira ?? ''))
  const [serviceCharge, setServiceCharge] = useState(
    String(suggested?.serviceChargeNaira ?? ''),
  )
  const [additionalFee, setAdditionalFee] = useState('0')

  const [state, formAction, isPending] = useActionState<CreateQuoteResult | null, FormData>(
    createQuoteAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'Quote sent.')
      router.refresh()
    }
  }, [state, router])

  const totalKobo = useMemo(
    () => toKobo(serviceFee) + toKobo(serviceCharge) + toKobo(additionalFee),
    [serviceFee, serviceCharge, additionalFee],
  )
  const serviceChargeKobo = toKobo(serviceCharge)
  const transportKobo = Math.round(serviceChargeKobo * 0.2)
  const executionKobo = serviceChargeKobo - transportKobo
  const agentShareKobo = Math.round(serviceChargeKobo * 0.6)

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="taskId" value={taskId} />
      <FormError message={state && !state.ok ? state.error : null} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="serviceFeeNaira" label="Service fee (₦)" required error={fieldErrors?.serviceFeeNaira}>
          {(props) => (
            <Input
              {...props}
              name="serviceFeeNaira"
              type="number"
              min="0"
              step="50"
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              required
            />
          )}
        </Field>
        <Field
          name="serviceChargeNaira"
          label="Total service charge (₦)"
          required
          hint="Transportation and task execution are calculated automatically."
          error={fieldErrors?.serviceChargeNaira}
        >
          {(props) => (
            <Input
              {...props}
              name="serviceChargeNaira"
              type="number"
              min="0"
              step="50"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}
              required
            />
          )}
        </Field>
      </div>

      <Field name="additionalFeeNaira" label="Additional charges (₦)" hint="Optional">
        {(props) => (
          <Input
            {...props}
            name="additionalFeeNaira"
            type="number"
            min="0"
            step="50"
            value={additionalFee}
            onChange={(e) => setAdditionalFee(e.target.value)}
          />
        )}
      </Field>

      <Field name="additionalFeeNote" label="Note for additional charges" hint="Shown to the customer if there's an additional charge">
        {(props) => <Input {...props} name="additionalFeeNote" placeholder="e.g. Parking / entry fee" />}
      </Field>

      <div className="rounded-lg border bg-muted/40 p-3.5 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Transportation (20%)</span>
          <span>{formatNaira(transportKobo)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-muted-foreground">
          <span>Task execution fee (80%)</span>
          <span>{formatNaira(executionKobo)}</span>
        </div>
        <div className="my-2 border-t" />
        <div className="flex items-center justify-between">
          <span className="font-medium">Go Agent payout (60% of service charge)</span>
          <span className="font-semibold">{formatNaira(agentShareKobo)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-muted-foreground">
          <span>Concierge Go share (40% of service charge)</span>
          <span>{formatNaira(serviceChargeKobo - agentShareKobo)}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Transportation is included in the agent payout; it is not added twice.
        </p>
      </div>

      <Field name="notes" label="Notes for the customer" hint="Optional">
        {(props) => <Textarea {...props} name="notes" rows={2} />}
      </Field>

      <Field name="expiresInHours" label="Quote expires in (hours)">
        {(props) => <Input {...props} name="expiresInHours" type="number" min="1" max="168" defaultValue={48} />}
      </Field>

      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3.5">
        <span className="text-sm font-medium">Total to customer</span>
        <span className="font-display text-lg font-bold tracking-tight">{formatNaira(totalKobo)}</span>
      </div>

      <Button type="submit" loading={isPending}>
        Send quote
      </Button>
    </form>
  )
}
