'use client'

import { useActionState } from 'react'

import {
  finalizePayoutTransferAction,
  sendPayoutAction,
  updatePayoutAction,
  type SendPayoutResult,
  type UpdatePayoutResult,
} from '@/actions/payouts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PayoutStatus } from '@/types/database'

const ACTIVE_PROVIDER_STATUSES = new Set(['initiating', 'pending', 'otp'])

export function PayoutActionForm({
  payoutId,
  currentStatus,
  payoutMode,
  providerStatus,
  hasBankAccount,
}: {
  payoutId: string
  currentStatus: PayoutStatus
  payoutMode: 'manual' | 'paystack'
  providerStatus: string | null
  hasBankAccount: boolean
}) {
  const [updateState, updateAction, updating] = useActionState<UpdatePayoutResult | null, FormData>(
    updatePayoutAction,
    null,
  )
  const [sendState, sendAction, sending] = useActionState<SendPayoutResult | null, FormData>(
    sendPayoutAction,
    null,
  )
  const [otpState, otpAction, finalizing] = useActionState<SendPayoutResult | null, FormData>(
    finalizePayoutTransferAction,
    null,
  )

  if (currentStatus === 'paid' || currentStatus === 'cancelled') return null

  const transferActive = ACTIVE_PROVIDER_STATUSES.has(providerStatus ?? '')
  const canManageStatus = !transferActive

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
      {currentStatus === 'approved' && payoutMode === 'paystack' ? (
        <>
          {!hasBankAccount ? (
            <p className="text-xs font-medium text-destructive">
              The agent has not added a verified payout bank account.
            </p>
          ) : null}

          {providerStatus === 'otp' ? (
            <form action={otpAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="payoutId" value={payoutId} />
              <Input
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit Paystack OTP"
                required
              />
              <Button type="submit" size="sm" loading={finalizing}>
                Confirm OTP
              </Button>
              <ActionMessage state={otpState} />
            </form>
          ) : providerStatus === 'initiating' || providerStatus === 'pending' ? (
            <p className="text-xs font-medium text-primary">
              Paystack is processing this bank transfer. Its final status will update automatically.
            </p>
          ) : (
            <form action={sendAction} className="flex flex-wrap items-center justify-between gap-2">
              <input type="hidden" name="payoutId" value={payoutId} />
              <p className="text-xs text-muted-foreground">
                {providerStatus === 'failed' || providerStatus === 'reversed'
                  ? 'The previous transfer did not complete. It is safe to retry with the same reference.'
                  : 'Send this approved earning directly to the agent’s bank account.'}
              </p>
              <Button type="submit" size="sm" loading={sending} disabled={!hasBankAccount}>
                {providerStatus === 'failed' || providerStatus === 'reversed'
                  ? 'Retry Paystack transfer'
                  : 'Send with Paystack'}
              </Button>
              <ActionMessage state={sendState} />
            </form>
          )}
        </>
      ) : null}

      {canManageStatus ? (
        <form action={updateAction} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="payoutId" value={payoutId} />
          <label className="space-y-1 text-xs font-medium">
            Status
            <select
              name="status"
              defaultValue={
                currentStatus === 'held'
                  ? 'pending'
                  : currentStatus === 'approved' && payoutMode === 'manual'
                    ? 'paid'
                    : currentStatus === 'approved'
                      ? 'held'
                      : 'approved'
              }
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {currentStatus === 'held' ? <option value="pending">Return to pending</option> : null}
              {currentStatus !== 'approved' ? <option value="approved">Approve</option> : null}
              {currentStatus === 'approved' && payoutMode === 'manual' ? (
                <option value="paid">Mark paid</option>
              ) : null}
              <option value="held">Place on hold</option>
              <option value="cancelled">Cancel</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            Transfer reference
            <Input
              name="paymentReference"
              placeholder={payoutMode === 'manual' ? 'Required when marking paid' : 'Not needed for approval'}
            />
          </label>
          <label className="space-y-1 text-xs font-medium sm:col-span-2">
            Note
            <Input name="note" placeholder="Optional operations note" />
          </label>
          <ActionMessage state={updateState} />
          <Button type="submit" size="sm" loading={updating} className="sm:col-span-2 sm:justify-self-end">
            Update payout
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function ActionMessage({ state }: { state: UpdatePayoutResult | SendPayoutResult | null }) {
  if (!state) return null
  return (
    <p
      className={`text-xs font-medium sm:col-span-2 ${state.ok ? 'text-success' : 'text-destructive'}`}
      role={state.ok ? 'status' : 'alert'}
    >
      {state.ok ? state.message : state.error}
    </p>
  )
}
