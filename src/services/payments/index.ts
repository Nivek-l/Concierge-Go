import 'server-only'

import { getAppUrl, getPaymentMode, isPaystackConfigured, requireServerEnv } from '@/lib/env'
import { AppError, ERROR_MESSAGES, logError } from '@/lib/errors'
import type { Json, PaymentProviderName } from '@/types/database'

/**
 * Payment abstraction.
 *
 * Two rules the rest of the application depends on:
 *
 *   1. A payment is only ever marked successful by `verifyPayment`, which asks
 *      the provider directly. The client tells us a transaction *finished*; it
 *      never tells us it *succeeded*.
 *   2. The amount charged is read from the accepted quote server-side. A client
 *      cannot influence the price.
 *
 * Adding Flutterwave, a wallet or bank-transfer reconciliation later means
 * writing another object with this shape and registering it below — no changes
 * to actions, pages or the database.
 */

export interface InitializePaymentParams {
  reference: string
  amountKobo: number
  email: string
  taskId: string
  taskReference: string
  customerName: string
  callbackUrl: string
}

export interface InitializePaymentResult {
  provider: PaymentProviderName
  reference: string
  /** Where to send the customer to pay. */
  authorizationUrl: string
  providerReference: string | null
  raw?: Json
}

export interface VerifyPaymentResult {
  provider: PaymentProviderName
  reference: string
  status: 'succeeded' | 'failed' | 'pending' | 'abandoned'
  amountKobo: number
  channel: string | null
  paidAt: string | null
  providerReference: string | null
  failureReason: string | null
  raw?: Json
}

export interface VerifyPaymentContext {
  amountKobo: number
  providerPayload: Json | null
}

export interface PaymentProvider {
  readonly name: PaymentProviderName
  readonly isMock: boolean
  initialize(params: InitializePaymentParams): Promise<InitializePaymentResult>
  verify(reference: string, context: VerifyPaymentContext): Promise<VerifyPaymentResult>
}

/* -------------------------------------------------------------------------- */
/* Mock provider — development only                                           */
/* -------------------------------------------------------------------------- */

/**
 * The mock provider moves no money. It sends the customer to an internal page
 * that is explicitly labelled as a development flow, where they choose success
 * or failure. Verification still round-trips through the server, so the code
 * path exercised in development is the same one Paystack will use.
 */
const MOCK_OUTCOMES = ['success', 'failed', 'pending'] as const
type MockOutcome = (typeof MOCK_OUTCOMES)[number]

function configuredMockOutcome(): MockOutcome {
  const requested = (process.env.MOCK_PAYMENT_OUTCOME ?? 'pending').toLowerCase()
  return MOCK_OUTCOMES.includes(requested as MockOutcome) ? (requested as MockOutcome) : 'pending'
}

function mockOutcomeFromPayload(payload: Json | null): MockOutcome {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const value = payload.mock_outcome
    if (typeof value === 'string' && MOCK_OUTCOMES.includes(value as MockOutcome)) {
      return value as MockOutcome
    }
  }
  return configuredMockOutcome()
}

const mockProvider: PaymentProvider = {
  name: 'mock',
  isMock: true,

  async initialize(params) {
    const url = new URL('/payments/mock', getAppUrl())
    url.searchParams.set('reference', params.reference)
    url.searchParams.set('task', params.taskId)

    return {
      provider: 'mock',
      reference: params.reference,
      authorizationUrl: url.toString(),
      providerReference: `mock_${params.reference}`,
      raw: {
        mode: 'mock',
        amount_kobo: params.amountKobo,
        task_reference: params.taskReference,
        mock_outcome: configuredMockOutcome(),
      },
    }
  },

  async verify(reference, context) {
    // The mock "provider" result is server-owned state. The browser may ask
    // the server to simulate an outcome, but verify() is still the authority
    // that translates that stored provider state into a payment result.
    const outcome = mockOutcomeFromPayload(context.providerPayload)
    const now = new Date().toISOString()

    return {
      provider: 'mock',
      reference,
      status: outcome === 'success' ? 'succeeded' : outcome,
      amountKobo: context.amountKobo,
      channel: 'mock',
      paidAt: outcome === 'success' ? now : null,
      providerReference: `mock_${reference}`,
      failureReason: outcome === 'failed' ? 'Declined by deterministic mock provider.' : null,
      raw: {
        mode: 'mock',
        mock_outcome: outcome,
        verified_at: now,
      },
    }
  },
}

/* -------------------------------------------------------------------------- */
/* Paystack                                                                   */
/* -------------------------------------------------------------------------- */

const PAYSTACK_BASE = 'https://api.paystack.co'

interface PaystackResponse<T> {
  status: boolean
  message: string
  data: T
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<PaystackResponse<T>> {
  const secret = requireServerEnv('PAYSTACK_SECRET_KEY')

  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as PaystackResponse<T> | null

  if (!response.ok || !payload) {
    logError('paystack.request', new Error(`HTTP ${response.status}`), { path })
    throw new AppError(ERROR_MESSAGES.paymentFailed, { code: 'paystack_http_error' })
  }

  return payload
}

interface PaystackInitData {
  authorization_url: string
  access_code: string
  reference: string
}

interface PaystackVerifyData {
  status: string
  reference: string
  amount: number
  channel: string | null
  paid_at: string | null
  gateway_response: string | null
  id: number
}

const paystackProvider: PaymentProvider = {
  name: 'paystack',
  isMock: false,

  async initialize(params) {
    const payload = await paystackFetch<PaystackInitData>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo, // Paystack transacts in kobo.
        reference: params.reference,
        currency: 'NGN',
        callback_url: params.callbackUrl,
        metadata: {
          task_id: params.taskId,
          task_reference: params.taskReference,
          customer_name: params.customerName,
          custom_fields: [
            {
              display_name: 'Task',
              variable_name: 'task_reference',
              value: params.taskReference,
            },
          ],
        },
      }),
    })

    if (!payload.status || !payload.data?.authorization_url) {
      logError('paystack.initialize', new Error(payload.message), { reference: params.reference })
      throw new AppError(ERROR_MESSAGES.paymentFailed, { code: 'paystack_init_failed' })
    }

    return {
      provider: 'paystack',
      reference: params.reference,
      authorizationUrl: payload.data.authorization_url,
      providerReference: payload.data.reference,
      raw: { access_code: payload.data.access_code },
    }
  },

  async verify(reference, _context) {
    const payload = await paystackFetch<PaystackVerifyData>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    )

    const data = payload.data
    const status =
      data?.status === 'success'
        ? ('succeeded' as const)
        : data?.status === 'abandoned'
          ? ('abandoned' as const)
          : data?.status === 'ongoing' || data?.status === 'pending'
            ? ('pending' as const)
            : ('failed' as const)

    return {
      provider: 'paystack',
      reference,
      status,
      amountKobo: data?.amount ?? 0,
      channel: data?.channel ?? null,
      paidAt: data?.paid_at ?? null,
      providerReference: data?.id ? String(data.id) : (data?.reference ?? null),
      failureReason: status === 'succeeded' ? null : (data?.gateway_response ?? payload.message),
      raw: { gateway_response: data?.gateway_response ?? null, paystack_status: data?.status ?? null },
    }
  },
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                  */
/* -------------------------------------------------------------------------- */

export function getPaymentProvider(): PaymentProvider {
  return getPaymentMode() === 'paystack' ? paystackProvider : mockProvider
}

export function getPaymentProviderByName(name: PaymentProviderName): PaymentProvider {
  return name === 'paystack' ? paystackProvider : mockProvider
}

export function paymentModeSummary() {
  const mode = getPaymentMode()
  return {
    mode,
    isMock: mode === 'mock',
    paystackConfigured: isPaystackConfigured(),
    label:
      mode === 'paystack'
        ? 'Paystack'
        : 'Development payment mode — no money moves and no card is charged.',
  }
}

/** Payment references are unique, greppable and safe in a URL. */
export function buildPaymentReference(taskReference: string) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `CGP-${taskReference.replace(/[^A-Z0-9]/gi, '')}-${Date.now().toString(36).toUpperCase()}-${random}`
}

/**
 * Paystack webhook signature check (HMAC SHA512 of the raw body with the
 * secret key). Wired up in app/api/webhooks/paystack/route.ts.
 */
export async function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false
  const { createHmac } = await import('node:crypto')
  const secret = requireServerEnv('PAYSTACK_SECRET_KEY')
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  // Constant-time compare.
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}
