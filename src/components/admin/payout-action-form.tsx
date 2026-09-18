'use client'

import { useActionState } from 'react'

import { updatePayoutAction, type UpdatePayoutResult } from '@/actions/payouts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PayoutStatus } from '@/types/database'

export function PayoutActionForm({
  payoutId,
  currentStatus,
}: {
  payoutId: string
  currentStatus: PayoutStatus
}) {
  const [state, action, pending] = useActionState<UpdatePayoutResult | null, FormData>(
    updatePayoutAction,
    null,
  )

  if (currentStatus === 'paid' || currentStatus === 'cancelled') return null

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
      <input type="hidden" name="payoutId" value={payoutId} />
      <label className="space-y-1 text-xs font-medium">
        Status
        <select
          name="status"
          defaultValue={currentStatus === 'approved' ? 'paid' : 'approved'}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {currentStatus === 'held' ? <option value="pending">Return to pending</option> : null}
          {currentStatus !== 'approved' ? <option value="approved">Approve</option> : null}
          {currentStatus === 'approved' ? <option value="paid">Mark paid</option> : null}
          <option value="held">Place on hold</option>
          <option value="cancelled">Cancel</option>
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium">
        Transfer reference
        <Input name="paymentReference" placeholder="Required when marking paid" />
      </label>
      <label className="space-y-1 text-xs font-medium sm:col-span-2">
        Note
        <Input name="note" placeholder="Optional operations note" />
      </label>
      {state && !state.ok ? (
        <p className="text-xs font-medium text-destructive sm:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="sm" loading={pending} className="sm:col-span-2 sm:justify-self-end">
        Update payout
      </Button>
    </form>
  )
}
