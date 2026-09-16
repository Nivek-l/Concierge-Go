import 'server-only'

import { AppError, logError } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { taskEvents } from '@/services/notifications'
import { getPaymentProviderByName } from '@/services/payments'
import type { Json, PaymentProviderName, TaskRow } from '@/types/database'

export type PaymentVerificationData = {
  status: 'succeeded' | 'failed' | 'pending'
  taskId: string
  amountKobo: number
}

function mergePayload(current: Json | null, next: Json | undefined): Json | null {
  if (!next) return current

  if (
    current &&
    typeof current === 'object' &&
    !Array.isArray(current) &&
    typeof next === 'object' &&
    !Array.isArray(next)
  ) {
    return { ...current, ...next }
  }

  return next
}

/**
 * Ask the payment provider for the truth, persist it, and release the task.
 *
 * This function deliberately has no browser-session dependency and performs
 * no Next.js cache revalidation. It is safe to call from a callback page, a
 * webhook, or a server action. Task release uses compare-and-set semantics so
 * concurrent callback and webhook requests cannot send duplicate notices.
 */
export async function verifyAndRecordPayment(
  reference: string,
): Promise<PaymentVerificationData> {
  const admin = createAdminClient()

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .select(
      'id, task_id, customer_id, amount_kobo, status, provider, reference, provider_payload',
    )
    .eq('reference', reference)
    .maybeSingle()

  if (paymentError) throw paymentError
  if (!payment) {
    throw new AppError('We could not find that payment.', {
      code: 'payment_not_found',
    })
  }

  const taskId = payment.task_id as string
  const amountKobo = payment.amount_kobo as number

  if (payment.status === 'succeeded') {
    return { status: 'succeeded', taskId, amountKobo }
  }

  if (payment.status === 'failed' || payment.status === 'abandoned') {
    return { status: 'failed', taskId, amountKobo }
  }

  const provider = getPaymentProviderByName(payment.provider as PaymentProviderName)
  const verification = await provider.verify(reference, {
    amountKobo,
    providerPayload: (payment.provider_payload ?? null) as Json | null,
  })
  const providerPayload = mergePayload(
    (payment.provider_payload ?? null) as Json | null,
    verification.raw,
  )

  if (verification.status !== 'succeeded') {
    const storedStatus = verification.status === 'pending' ? 'processing' : verification.status
    const { error: updateError } = await admin
      .from('payments')
      .update({
        status: storedStatus,
        failure_reason: verification.failureReason,
        provider_reference: verification.providerReference,
        provider_payload: providerPayload,
      })
      .eq('id', payment.id as string)

    if (updateError) throw updateError

    return {
      status: verification.status === 'pending' ? 'pending' : 'failed',
      taskId,
      amountKobo,
    }
  }

  // Paystack reports the captured amount. Requiring an exact match prevents
  // both underpayment and an accidentally mismatched transaction from
  // releasing a task.
  if (!provider.isMock && verification.amountKobo !== amountKobo) {
    const failureReason = `Amount mismatch: expected ${amountKobo} kobo, received ${verification.amountKobo}.`
    const { error: mismatchError } = await admin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: failureReason,
        provider_reference: verification.providerReference,
        provider_payload: providerPayload,
      })
      .eq('id', payment.id as string)

    if (mismatchError) throw mismatchError

    logError('payments.amountMismatch', new Error(failureReason), {
      reference,
      expectedKobo: amountKobo,
      receivedKobo: verification.amountKobo,
    })

    throw new AppError(
      'The amount received does not match the quote. Operations will review the payment before the task starts.',
      { code: 'payment_amount_mismatch' },
    )
  }

  const { error: successError } = await admin
    .from('payments')
    .update({
      status: 'succeeded',
      channel: verification.channel,
      paid_at: verification.paidAt ?? new Date().toISOString(),
      provider_reference: verification.providerReference,
      provider_payload: providerPayload,
      failure_reason: null,
    })
    .eq('id', payment.id as string)

  if (successError) throw successError

  const { data: task, error: taskError } = await admin
    .from('tasks')
    .select('id, reference, title, customer_id, status')
    .eq('id', taskId)
    .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

  if (taskError) throw taskError

  if (task?.status === 'awaiting_payment') {
    const { data: releasedTask, error: releaseError } = await admin
      .from('tasks')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('status', 'awaiting_payment')
      .select('id')
      .maybeSingle()

    if (releaseError) throw releaseError

    // Only the request that won the state transition sends notifications.
    if (releasedTask) {
      const { data: customer, error: customerError } = await admin
        .from('profiles')
        .select('email')
        .eq('id', task.customer_id)
        .maybeSingle()

      if (customerError) {
        logError('payments.customerLookup', customerError, { reference, taskId })
      }

      await taskEvents.paymentReceived(
        task,
        task.customer_id,
        amountKobo,
        (customer?.email as string | undefined) ?? null,
      )
    }
  }

  console.info('[payment:verified]', {
    reference,
    provider: provider.name,
    taskId,
  })

  return { status: 'succeeded', taskId, amountKobo }
}
