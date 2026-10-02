'use server'

import { revalidatePath } from 'next/cache'

import { requireCustomerAction, requireUserAction } from '@/lib/auth'
import { getAppUrl, getPaymentMode } from '@/lib/env'
import { ERROR_MESSAGES, logError, toUserMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { initiatePaymentSchema, verifyPaymentSchema } from '@/lib/validations'
import { buildPaymentReference, getPaymentProvider } from '@/services/payments'
import {
  verifyAndRecordPayment,
  type PaymentVerificationData,
} from '@/services/payments/reconcile'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { Json, TaskRow } from '@/types/database'

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
    const provider = getPaymentProvider()

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (taskError) throw taskError
    if (!task || task.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)

    if (task.status !== 'awaiting_payment') {
      return actionError(
        task.status === 'paid'
          ? 'This task has already been paid for.'
          : 'This task is not ready for payment yet.',
      )
    }

    const { data: quote, error: quoteError } = await supabase
      .from('task_quotes')
      .select('id, total_kobo, status')
      .eq('task_id', taskId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (quoteError) throw quoteError
    if (!quote) return actionError('There is no accepted quote for this task.')

    const amountKobo = quote.total_kobo as number
    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      return actionError('That quote amount is not valid.')
    }

    // Reuse only a recent attempt for the same provider. This prevents a stale
    // Paystack session from retaining an old callback URL after a domain change.
    const { data: existing, error: existingError } = await supabase
      .from('payments')
      .select('id, reference, authorization_url, status, created_at')
      .eq('task_id', taskId)
      .eq('provider', provider.name)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) throw existingError

    const createdAt = existing?.created_at ? Date.parse(existing.created_at as string) : 0
    const isRecent = Number.isFinite(createdAt) && Date.now() - createdAt < 30 * 60 * 1000

    if (isRecent && existing?.authorization_url) {
      return actionOk({
        authorizationUrl: existing.authorization_url as string,
        reference: existing.reference as string,
        isMock: provider.isMock,
      })
    }

    const reference = buildPaymentReference(task.reference)
    const callbackUrl = new URL('/payments/callback', getAppUrl()).toString()

    console.info('[payment:initialize]', {
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

    const admin = createAdminClient()
    const { error: insertError } = await admin.from('payments').insert({
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

    if (insertError) throw insertError

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

export type VerifyPaymentResultData = PaymentVerificationData

/** Authenticated wrapper for a manual verification request from client UI. */
export async function verifyPaymentAction(
  reference: string,
): Promise<ActionResult<VerifyPaymentResultData>> {
  const parsed = verifyPaymentSchema.safeParse({ reference })
  if (!parsed.success) return actionError('That payment reference is not valid.')

  try {
    const user = await requireUserAction()
    const admin = createAdminClient()
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('task_id, customer_id')
      .eq('reference', parsed.data.reference)
      .maybeSingle()

    if (paymentError) throw paymentError
    if (!payment) return actionError('We could not find that payment.')
    if (payment.customer_id !== user.id && user.role !== 'admin') {
      return actionError(ERROR_MESSAGES.forbidden)
    }

    const result = await verifyAndRecordPayment(parsed.data.reference)
    revalidatePath(`/tasks/${result.taskId}`)
    revalidatePath('/dashboard')
    revalidatePath('/admin')

    return actionOk(
      result,
      result.status === 'succeeded'
        ? 'Payment received. We are assigning a Go Agent.'
        : undefined,
    )
  } catch (error) {
    logError('payments.verify', error, { reference })
    return actionError(toUserMessage(error, ERROR_MESSAGES.paymentFailed))
  }
}

/** Store a mock outcome, then run the same reconciliation path as Paystack. */
export async function completeMockPaymentAction(
  reference: string,
  outcome: 'success' | 'failure',
): Promise<ActionResult<PaymentVerificationData>> {
  if (getPaymentMode() !== 'mock') {
    return actionError('Mock payments are disabled on this deployment.')
  }

  const parsed = verifyPaymentSchema.safeParse({ reference })
  if (!parsed.success) return actionError('That payment reference is not valid.')

  try {
    const user = await requireCustomerAction()
    const admin = createAdminClient()
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id, task_id, customer_id, status, provider, provider_payload')
      .eq('reference', parsed.data.reference)
      .maybeSingle()

    if (paymentError) throw paymentError
    if (!payment) return actionError('We could not find that payment.')
    if (payment.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)
    if (payment.provider !== 'mock') return actionError('That payment is not a mock transaction.')

    const currentPayload =
      payment.provider_payload &&
      typeof payment.provider_payload === 'object' &&
      !Array.isArray(payment.provider_payload)
        ? payment.provider_payload
        : {}

    const { error: updateError } = await admin
      .from('payments')
      .update({
        status:
          payment.status === 'failed' || payment.status === 'abandoned'
            ? 'pending'
            : payment.status,
        failure_reason: null,
        provider_payload: {
          ...(currentPayload as Record<string, Json>),
          mock_outcome: outcome === 'success' ? 'succeeded' : 'failed',
          mock_selected_at: new Date().toISOString(),
        },
      })
      .eq('id', payment.id as string)

    if (updateError) throw updateError

    const result = await verifyAndRecordPayment(parsed.data.reference)
    revalidatePath(`/tasks/${result.taskId}`)
    revalidatePath('/dashboard')
    revalidatePath('/admin')
    return actionOk(result)
  } catch (error) {
    logError('payments.completeMock', error, { reference, outcome })
    return actionError(toUserMessage(error, ERROR_MESSAGES.paymentFailed))
  }
}
