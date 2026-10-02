'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminAction } from '@/lib/auth'
import { getPayoutMode } from '@/lib/env'
import { logError, toUserMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  fieldErrorsFrom,
  finalizePayoutTransferSchema,
  sendPayoutSchema,
  updatePayoutSchema,
} from '@/lib/validations'
import {
  createPaystackTransferRecipient,
  finalizePaystackTransfer,
  initiatePaystackTransfer,
} from '@/services/payouts/paystack'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { AgentBankAccountRow, AgentPayoutRow, PayoutStatus } from '@/types/database'

export type UpdatePayoutResult = ActionResult<{ payoutId: string; status: PayoutStatus }>

const allowedTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['approved', 'held', 'cancelled'],
  approved: ['paid', 'held', 'cancelled'],
  paid: [],
  held: ['pending', 'approved', 'cancelled'],
  cancelled: [],
}

export async function updatePayoutAction(
  _previous: UpdatePayoutResult | null,
  formData: FormData,
): Promise<UpdatePayoutResult> {
  const parsed = updatePayoutSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return actionError('Check the payout update.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { payoutId, status, paymentReference, note } = parsed.data

  try {
    const admin = await requireAdminAction()
    const supabase = await createClient()
    const { data: payout, error: readError } = await supabase
      .from('agent_payouts')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle<AgentPayoutRow>()

    if (readError) throw readError
    if (!payout) return actionError('That payout entry could not be found.')
    if (!allowedTransitions[payout.status].includes(status)) {
      return actionError(`A ${payout.status} payout cannot be moved to ${status}.`)
    }
    if (status === 'paid' && getPayoutMode() === 'paystack') {
      return actionError('Use “Send with Paystack” so the transfer can be verified automatically.')
    }

    const now = new Date().toISOString()
    const update: Record<string, string | null> = { status, note }
    if (status === 'approved') {
      update.approved_by = admin.id
      update.approved_at = now
    }
    if (status === 'paid') {
      update.paid_by = admin.id
      update.paid_at = now
      update.payment_reference = paymentReference
      update.payout_method = 'manual'
      update.provider_status = 'manual_confirmed'
    }

    const { data: updated, error } = await supabase
      .from('agent_payouts')
      .update(update)
      .eq('id', payoutId)
      .eq('status', payout.status)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!updated) return actionError('This payout changed while you were reviewing it. Refresh and try again.')

    revalidatePath('/admin/payouts')
    revalidatePath('/admin')
    revalidatePath('/agent/earnings')
    revalidatePath('/agent')
    return actionOk({ payoutId, status }, `Payout marked ${status}.`)
  } catch (error) {
    logError('payouts.update', error, { payoutId, status })
    return actionError(toUserMessage(error, 'We could not update that payout.'))
  }
}

export type SendPayoutResult = ActionResult<{
  payoutId: string
  providerStatus: string
}>

function payoutReference(payoutId: string) {
  return `cgp_${payoutId.replaceAll('-', '')}`
}

async function ensureRecipient(
  bankAccount: AgentBankAccountRow,
  agentId: string,
): Promise<string> {
  if (bankAccount.recipient_active && bankAccount.recipient_code) {
    return bankAccount.recipient_code
  }

  const recipient = await createPaystackTransferRecipient({
    name: bankAccount.account_name,
    accountNumber: bankAccount.account_number,
    bankCode: bankAccount.bank_code,
    description: `Concierge Go payout account for agent ${agentId}`,
  })
  if (!recipient.recipient_code) {
    throw new Error('Paystack did not return a transfer recipient code.')
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('agent_bank_accounts')
    .update({
      recipient_code: recipient.recipient_code,
      recipient_active: recipient.active,
      verified_at: new Date().toISOString(),
    })
    .eq('id', bankAccount.id)
  if (error) throw error

  return recipient.recipient_code
}

export async function sendPayoutAction(
  _previous: SendPayoutResult | null,
  formData: FormData,
): Promise<SendPayoutResult> {
  const parsed = sendPayoutSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return actionError('That payout reference is not valid.')
  const { payoutId } = parsed.data

  try {
    const admin = await requireAdminAction()
    if (getPayoutMode() !== 'paystack') {
      return actionError('Paystack payouts are disabled. Change PAYOUT_MODE to paystack first.')
    }

    const adminClient = createAdminClient()
    const { data: payout, error: payoutError } = await adminClient
      .from('agent_payouts')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle<AgentPayoutRow>()
    if (payoutError) throw payoutError
    if (!payout) return actionError('That payout entry could not be found.')
    if (payout.status !== 'approved') {
      return actionError('Approve this payout before sending it.')
    }
    if (['initiating', 'pending', 'otp', 'success'].includes(payout.provider_status ?? '')) {
      return actionError('This Paystack transfer has already been started.')
    }

    const { data: bankAccount, error: bankError } = await adminClient
      .from('agent_bank_accounts')
      .select('*')
      .eq('agent_id', payout.agent_id)
      .maybeSingle<AgentBankAccountRow>()
    if (bankError) throw bankError
    if (!bankAccount) {
      return actionError('This agent must verify a payout bank account before you can send money.')
    }

    const recipientCode = await ensureRecipient(bankAccount, payout.agent_id)
    const reference = payout.payment_reference ?? payoutReference(payout.id)
    const now = new Date().toISOString()

    const { data: reserved, error: reserveError } = await adminClient
      .from('agent_payouts')
      .update({
        payout_method: 'paystack',
        payment_reference: reference,
        provider_status: 'initiating',
        transfer_initiated_at: payout.transfer_initiated_at ?? now,
        failure_reason: null,
      })
      .eq('id', payout.id)
      .eq('status', 'approved')
      .or('provider_status.is.null,provider_status.in.(failed,reversed)')
      .select('id')
      .maybeSingle()
    if (reserveError) throw reserveError
    if (!reserved) return actionError('This payout is already being processed. Refresh the ledger.')

    let transfer: Awaited<ReturnType<typeof initiatePaystackTransfer>>
    try {
      transfer = await initiatePaystackTransfer({
        amountKobo: payout.amount_kobo,
        recipientCode,
        reference,
        reason: `Concierge Go task payout ${payout.task_id}`,
      })
    } catch (error) {
      await adminClient
        .from('agent_payouts')
        .update({ provider_status: 'failed', failure_reason: toUserMessage(error) })
        .eq('id', payout.id)
      throw error
    }

    const providerStatus = transfer.status || 'pending'
    const update: Record<string, string | null> = {
      provider_transfer_code: transfer.transfer_code,
      provider_status: providerStatus,
      failure_reason: transfer.failures ?? null,
    }
    if (providerStatus === 'success') {
      update.status = 'paid'
      update.paid_by = admin.id
      update.paid_at = transfer.transferred_at ?? now
    }

    // Once Paystack accepts the request, keep the payout reserved even if this
    // database write fails. The signed webhook can still finish reconciliation;
    // allowing an immediate retry here could pay the agent twice.
    const { error: updateError } = await adminClient
      .from('agent_payouts')
      .update(update)
      .eq('id', payout.id)
    if (updateError) throw updateError

    revalidatePayoutPages()
    const message =
      providerStatus === 'otp'
        ? 'Paystack sent an OTP. Enter it below to complete the transfer.'
        : providerStatus === 'success'
          ? 'Paystack confirmed the agent payout.'
          : 'The bank transfer has been sent to Paystack for processing.'
    return actionOk({ payoutId, providerStatus }, message)
  } catch (error) {
    logError('payouts.sendPaystack', error, { payoutId })
    revalidatePayoutPages()
    return actionError(toUserMessage(error, 'We could not send that payout through Paystack.'))
  }
}

export async function finalizePayoutTransferAction(
  _previous: SendPayoutResult | null,
  formData: FormData,
): Promise<SendPayoutResult> {
  const parsed = finalizePayoutTransferSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return actionError('Enter the 6-digit Paystack OTP.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { payoutId, otp } = parsed.data
  try {
    const admin = await requireAdminAction()
    if (getPayoutMode() !== 'paystack') return actionError('Paystack payouts are disabled.')
    const adminClient = createAdminClient()
    const { data: payout, error } = await adminClient
      .from('agent_payouts')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle<AgentPayoutRow>()
    if (error) throw error
    if (!payout?.provider_transfer_code || payout.provider_status !== 'otp') {
      return actionError('This payout is not waiting for an OTP.')
    }

    const transfer = await finalizePaystackTransfer(payout.provider_transfer_code, otp)
    const providerStatus = transfer.status || 'pending'
    const update: Record<string, string | null> = {
      provider_status: providerStatus,
      failure_reason: transfer.failures ?? null,
    }
    if (providerStatus === 'success') {
      update.status = 'paid'
      update.paid_by = admin.id
      update.paid_at = transfer.transferred_at ?? new Date().toISOString()
    }
    const { error: updateError } = await adminClient
      .from('agent_payouts')
      .update(update)
      .eq('id', payout.id)
    if (updateError) throw updateError

    revalidatePayoutPages()
    return actionOk(
      { payoutId, providerStatus },
      providerStatus === 'success'
        ? 'Paystack confirmed the agent payout.'
        : 'OTP accepted. The bank transfer is processing.',
    )
  } catch (error) {
    logError('payouts.finalizePaystack', error, { payoutId })
    return actionError(toUserMessage(error, 'Paystack could not confirm that OTP.'))
  }
}

function revalidatePayoutPages() {
  revalidatePath('/admin/payouts')
  revalidatePath('/admin')
  revalidatePath('/agent/earnings')
  revalidatePath('/agent')
}
