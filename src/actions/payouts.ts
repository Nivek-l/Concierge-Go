'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminAction } from '@/lib/auth'
import { logError, toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { fieldErrorsFrom, updatePayoutSchema } from '@/lib/validations'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { AgentPayoutRow, PayoutStatus } from '@/types/database'

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
