import { NextResponse, type NextRequest } from 'next/server'

import { logError } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaymentSchema } from '@/lib/validations'
import { verifyPaystackSignature } from '@/services/payments'
import { verifyAndRecordPayment } from '@/services/payments/reconcile'
import type { AgentPayoutRow } from '@/types/database'

type PaystackEvent = {
  event?: string
  data?: {
    reference?: unknown
    amount?: unknown
    status?: unknown
    transfer_code?: unknown
    transferred_at?: unknown
    failures?: unknown
    gateway_response?: unknown
  }
}

/**
 * Reliable, session-free Paystack confirmation. The HMAC is checked against
 * the unmodified request body, then the transaction is independently fetched
 * from Paystack before any payment or task status is changed.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  try {
    if (!(await verifyPaystackSignature(rawBody, signature))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch (error) {
    logError('webhooks.paystack.signature', error)
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 500 })
  }

  let event: PaystackEvent
  try {
    event = JSON.parse(rawBody) as PaystackEvent
  } catch (error) {
    logError('webhooks.paystack.parse', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (event.event === 'charge.success') {
    const parsed = verifyPaymentSchema.safeParse({ reference: event.data?.reference })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 })
    }

    try {
      const result = await verifyAndRecordPayment(parsed.data.reference)
      return NextResponse.json({ received: true, status: result.status })
    } catch (error) {
      // A non-2xx response asks Paystack to retry instead of permanently losing
      // confirmation during a temporary database or network failure.
      logError('webhooks.paystack.verify', error, { reference: parsed.data.reference })
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
    }
  }

  if (
    event.event === 'transfer.success' ||
    event.event === 'transfer.failed' ||
    event.event === 'transfer.reversed'
  ) {
    return recordTransferEvent(event)
  }

  return NextResponse.json({ received: true, ignored: true })
}

async function recordTransferEvent(event: PaystackEvent) {
  const reference = typeof event.data?.reference === 'string' ? event.data.reference : null
  if (!reference) return NextResponse.json({ error: 'Missing transfer reference' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data: payout, error: readError } = await admin
      .from('agent_payouts')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle<AgentPayoutRow>()
    if (readError) throw readError
    if (!payout) {
      // A valid event can belong to another Paystack integration flow. It is
      // acknowledged without mutating any Concierge Go payout.
      return NextResponse.json({ received: true, unmatched: true })
    }

    const amount = typeof event.data?.amount === 'number' ? event.data.amount : null
    if (amount !== null && amount !== payout.amount_kobo) {
      logError('webhooks.paystack.transferAmount', new Error('Transfer amount mismatch'), {
        reference,
        expected: payout.amount_kobo,
        received: amount,
      })
      return NextResponse.json({ error: 'Transfer amount mismatch' }, { status: 400 })
    }

    const providerStatus = event.event?.replace('transfer.', '') ?? 'unknown'
    const update: Record<string, string | null> = {
      provider_status: providerStatus,
      provider_transfer_code:
        typeof event.data?.transfer_code === 'string'
          ? event.data.transfer_code
          : payout.provider_transfer_code,
      failure_reason:
        providerStatus === 'success'
          ? null
          : typeof event.data?.failures === 'string'
            ? event.data.failures
            : typeof event.data?.gateway_response === 'string'
              ? event.data.gateway_response
              : `Paystack reported the transfer as ${providerStatus}.`,
    }

    if (providerStatus === 'success' && payout.status !== 'paid') {
      update.status = 'paid'
      update.paid_by = payout.approved_by
      update.paid_at =
        typeof event.data?.transferred_at === 'string'
          ? event.data.transferred_at
          : new Date().toISOString()
    }

    const { error: updateError } = await admin
      .from('agent_payouts')
      .update(update)
      .eq('id', payout.id)
    if (updateError) throw updateError

    return NextResponse.json({ received: true, status: providerStatus })
  } catch (error) {
    logError('webhooks.paystack.transfer', error, { reference, event: event.event })
    return NextResponse.json({ error: 'Transfer update failed' }, { status: 500 })
  }
}
