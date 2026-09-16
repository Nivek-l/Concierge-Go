'use server'

import { revalidatePath } from 'next/cache'

import { requireCustomerAction, requireUserAction } from '@/lib/auth'
import { getAppUrl, getPaymentMode } from '@/lib/env'
import { ERROR_MESSAGES, logError, toUserMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { initiatePaymentSchema, verifyPaymentSchema } from '@/lib/validations'
import { buildPaymentReference, getPaymentProvider } from '@/services/payments'
import { taskEvents } from '@/services/notifications'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { TaskRow } from '@/types/database'

/**
 * Payment actions.
 *
 * Two invariants, enforced here and nowhere else:
 *
 *   1. **The amount comes from the accepted quote**, read server-side. The
 *      client never sends a price.
 *   2. **Only the provider decides success.** `verifyPaymentAction` asks the
 *      provider and writes the result with the service-role client, because the
 *      customer must not be able to write their own payment status — RLS gives
 *      them no update policy on `payments` at all.
 */

export type InitiatePaymentResult = ActionResult<{
  authorizationUrl: string
  reference: string
  isMock: boolean
}>

export async function initiatePaymentAction(
  _prev: InitiatePaymentResult | null,
  formData: FormData,
): Promise<InitiatePaymentResult> {
  const parsed = initiatePaymentSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return actionError('That task is not valid.')

  const { taskId } = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task || task.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)

    if (task.status !== 'awaiting_payment') {
      return actionError(
        task.status === 'paid'
          ? 'This task has already been paid for.'
          : 'This task is not ready for payment yet.',
      )
    }

    // The authoritative amount.
    const { data: quote } = await supabase
      .from('task_quotes')
      .select('id, total_kobo, status')
      .eq('task_id', taskId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!quote) return actionError('There is no accepted quote for this task.')

    const amountKobo = quote.total_kobo as number
    if (!amountKobo || amountKobo <= 0) return actionError('That quote amount is not valid.')

    // Reuse a pending attempt rather than stacking rows on a double-click.
    const { data: existing } = await supabase
      .from('payments')
      .select('id, reference, authorization_url, status')
      .eq('task_id', taskId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const provider = getPaymentProvider()

    if (existing?.authorization_url) {
      return actionOk({
        authorizationUrl: existing.authorization_url as string,
        reference: existing.reference as string,
        isMock: provider.isMock,
      })
    }

    const reference = buildPaymentReference(task.reference)

    const callbackUrl =
  `${getAppUrl()}/payments/callback`

console.error('[payment:callback-url]', {
  reference,
  callbackUrl,
  provider: provider.name,
})

const initialized = await provider.initialize({
  reference,
  amountKobo,
  email: user.email,
  taskId: task.id,
  taskReference: task.reference,
  customerName: user.profile.full_name,
  callbackUrl,
})

    // Written with the service-role client: `payments` has no insert policy for
    // customers, by design.
    const admin = createAdminClient()
    const { error } = await admin.from('payments').insert({
      task_id: task.id,
      quote_id: quote.id as string,
      customer_id: user.id,
      provider: initialized.provider,
      reference: initialized.reference,
      provider_reference: initialized.providerReference,
      amount_kobo: amountKobo,
      currency: 'NGN',
      status: 'pending',
      authorization_url: initialized.authorizationUrl,
      provider_payload: initialized.raw ?? null,
    })

    if (error) throw error

    revalidatePath(`/tasks/${taskId}`)
    return actionOk({
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      isMock: provider.isMock,
    })
  } catch (error) {
    logError('payments.initiate', error, { taskId })
    return actionError(toUserMessage(error, ERROR_MESSAGES.paymentFailed))
  }
}

export type VerifyPaymentResultData = {
  status: 'succeeded' | 'failed' | 'pending'
  taskId: string
  amountKobo: number
}

/**
 * Verify a payment and, if it really succeeded, advance the task.
 *
 * Safe to call repeatedly — the payment-status check makes it idempotent, so
 * the callback page, a refresh and the webhook can all run it.
 */
export async function verifyPaymentAction(
  reference: string,
): Promise<ActionResult<VerifyPaymentResultData>> {
  const parsed = verifyPaymentSchema.safeParse({ reference })
  if (!parsed.success) return actionError('That payment reference is not valid.')

  try {
    const user = await requireUserAction()
    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('id, task_id, customer_id, amount_kobo, status, provider, reference')
      .eq('reference', parsed.data.reference)
      .maybeSingle()

    if (!payment) return actionError('We could not find that payment.')

    // Only the payer or operations may ask about a payment.
    if (payment.customer_id !== user.id && user.role !== 'admin') {
      return actionError(ERROR_MESSAGES.forbidden)
    }

    const taskId = payment.task_id as string

    if (payment.status === 'succeeded') {
      return actionOk({
        status: 'succeeded',
        taskId,
        amountKobo: payment.amount_kobo as number,
      })
    }

    if (payment.status === 'failed' || payment.status === 'abandoned') {
      return actionError(ERROR_MESSAGES.paymentFailed)
    }

    const provider = getPaymentProvider()
    const verification = await provider.verify(parsed.data.reference)

    if (verification.status !== 'succeeded') {
      await admin
        .from('payments')
        .update({
          status: verification.status === 'pending' ? 'processing' : verification.status,
          failure_reason: verification.failureReason,
          provider_payload: verification.raw ?? null,
        })
        .eq('id', payment.id as string)

      revalidatePath(`/tasks/${taskId}`)

      if (verification.status === 'pending') {
        return actionOk({ status: 'pending', taskId, amountKobo: payment.amount_kobo as number })
      }
      return actionError(ERROR_MESSAGES.paymentFailed)
    }

    // Real providers report the amount they actually captured. Underpayment is
    // never treated as success.
    const expectedKobo = payment.amount_kobo as number
    if (!provider.isMock && verification.amountKobo > 0 && verification.amountKobo < expectedKobo) {
      await admin
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: `Amount mismatch: expected ${expectedKobo} kobo, received ${verification.amountKobo}.`,
          provider_payload: verification.raw ?? null,
        })
        .eq('id', payment.id as string)

      logError('payments.amountMismatch', new Error('amount mismatch'), {
        reference: parsed.data.reference,
        expectedKobo,
        receivedKobo: verification.amountKobo,
      })

      return actionError(
        'The amount received does not match the quote. Operations will contact you — no task has been started.',
      )
    }

    await admin
      .from('payments')
      .update({
        status: 'succeeded',
        channel: verification.channel,
        paid_at: verification.paidAt ?? new Date().toISOString(),
        provider_reference: verification.providerReference,
        provider_payload: verification.raw ?? null,
        failure_reason: null,
      })
      .eq('id', payment.id as string)

    const { data: task } = await admin
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (task && task.status === 'awaiting_payment') {
      await admin
        .from('tasks')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', taskId)

      const { data: customer } = await admin
        .from('profiles')
        .select('email')
        .eq('id', task.customer_id)
        .maybeSingle()

      await taskEvents.paymentReceived(
        task,
        task.customer_id,
        expectedKobo,
        (customer?.email as string | undefined) ?? null,
      )
    }

    return actionOk(
      { status: 'succeeded', taskId, amountKobo: expectedKobo },
      'Payment received. We are assigning a Go Agent.',
    )
  } catch (error) {
    logError('payments.verify', error, { reference })
    return actionError(toUserMessage(error, ERROR_MESSAGES.paymentFailed))
  }
}

/**
 * Development only: the mock checkout page records the developer's chosen
 * outcome. Refuses to run when a real provider is configured.
 */
export async function completeMockPaymentAction(
  reference: string,
  outcome: 'success' | 'failure',
): Promise<ActionResult<{ taskId: string; status: string }>> {
  if (getPaymentMode() !== 'mock') {
    return actionError('Mock payments are disabled on this deployment.')
  }

  try {
    const user = await requireCustomerAction()
    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('payments')
      .select('id, task_id, customer_id, status, provider')
      .eq('reference', reference)
      .maybeSingle()

    if (!payment) return actionError('We could not find that payment.')
    if (payment.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)
    if (payment.provider !== 'mock') return actionError('That payment is not a mock transaction.')

    const taskId = payment.task_id as string

    if (outcome === 'failure') {
      await admin
        .from('payments')
        .update({
          status: 'failed',
          failure_reason: 'Declined in development payment mode.',
        })
        .eq('id', payment.id as string)

      revalidatePath(`/tasks/${taskId}`)
      return actionOk({ taskId, status: 'failed' })
    }

    const result = await verifyPaymentAction(reference)
    if (!result.ok) return actionError(result.error)

    return actionOk({ taskId, status: 'succeeded' })
  } catch (error) {
    logError('payments.completeMock', error, { reference })
    return actionError(toUserMessage(error, ERROR_MESSAGES.paymentFailed))
  }
}
