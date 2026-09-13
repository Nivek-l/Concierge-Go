import { NextResponse, type NextRequest } from 'next/server'

import { logError } from '@/lib/errors'
import { verifyPaymentAction } from '@/actions/payments'
import { verifyPaystackSignature } from '@/services/payments'

/**
 * Paystack calls this when a transaction completes, as a more reliable
 * backup to the customer's browser redirect landing on /payments/callback.
 * Both paths call the same `verifyPaymentAction`, which re-checks with
 * Paystack directly and is idempotent — so it is safe if both fire.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  const valid = await verifyPaystackSignature(rawBody, signature).catch((error) => {
    logError('webhooks.paystack.signature', error)
    return false
  })

  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const event = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } }
    const reference = event.data?.reference

    if (event.event === 'charge.success' && reference) {
      // verifyPaymentAction is written for a signed-in caller (the browser
      // redirect to /payments/callback, which always has a session) and is
      // idempotent, so that path is what actually confirms payment today.
      // This webhook is kept as a best-effort second signal for future
      // hardening — e.g. a service-role verification helper — without
      // blocking the MVP on it; failures here are logged and swallowed.
      await verifyPaymentAction(reference).catch((error) => {
        logError('webhooks.paystack.verify', error, { reference })
      })
    }
  } catch (error) {
    logError('webhooks.paystack.parse', error)
  }

  // Always 200 — Paystack retries aggressively on non-2xx responses.
  return NextResponse.json({ received: true })
}
