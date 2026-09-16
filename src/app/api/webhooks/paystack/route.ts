import { NextResponse, type NextRequest } from 'next/server'

import { logError } from '@/lib/errors'
import { verifyPaymentSchema } from '@/lib/validations'
import { verifyPaystackSignature } from '@/services/payments'
import { verifyAndRecordPayment } from '@/services/payments/reconcile'

type PaystackEvent = {
  event?: string
  data?: { reference?: unknown }
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

  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true, ignored: true })
  }

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
