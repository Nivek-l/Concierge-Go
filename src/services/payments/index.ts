import 'server-only'

import {
  getAppUrl,
  getPaymentMode,
  isPaystackConfigured,
  requireServerEnv,
} from '@/lib/env'
import { AppError, ERROR_MESSAGES, logError } from '@/lib/errors'
import type { Json, PaymentProviderName } from '@/types/database'

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
  authorizationUrl: string
  providerReference: string | null
  raw?: Json
}

export interface VerifyPaymentContext {
  amountKobo: number
  providerPayload: Json | null
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

export interface PaymentProvider {
  readonly name: PaymentProviderName
  readonly isMock: boolean

  initialize(
    params: InitializePaymentParams,
  ): Promise<InitializePaymentResult>

  verify(
    reference: string,
    context?: VerifyPaymentContext,
  ): Promise<VerifyPaymentResult>
}

/* -------------------------------------------------------------------------- */
/* Mock provider                                                              */
/* -------------------------------------------------------------------------- */

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
      },
    }
  },

  async verify(reference, context) {
    const providerPayload = context?.providerPayload

    const savedOutcome =
      providerPayload &&
      typeof providerPayload === 'object' &&
      !Array.isArray(providerPayload) &&
      typeof providerPayload.mock_outcome === 'string'
        ? providerPayload.mock_outcome
        : 'pending'

    const status =
      savedOutcome === 'success' || savedOutcome === 'succeeded'
        ? ('succeeded' as const)
        : savedOutcome === 'failed' || savedOutcome === 'failure'
          ? ('failed' as const)
          : savedOutcome === 'abandoned'
            ? ('abandoned' as const)
            : ('pending' as const)

    return {
      provider: 'mock',
      reference,
      status,
      amountKobo: context?.amountKobo ?? 0,
      channel: 'mock',
      paidAt: status === 'succeeded' ? new Date().toISOString() : null,
      providerReference: `mock_${reference}`,
      failureReason:
        status === 'failed'
          ? 'The simulated payment failed.'
          : status === 'abandoned'
            ? 'The simulated payment was abandoned.'
            : null,
      raw: {
        mode: 'mock',
        mock_outcome: savedOutcome,
        verified_at: new Date().toISOString(),
      },
    }
  },
}

/* -------------------------------------------------------------------------- */
/* Paystack provider                                                          */
/* -------------------------------------------------------------------------- */

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

interface PaystackResponse<T> {
  status: boolean
  message: string
  data: T
}

interface PaystackInitializeData {
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

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<PaystackResponse<T>> {
  const secretKey = requireServerEnv('PAYSTACK_SECRET_KEY')

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const payload = (await response
    .json()
    .catch(() => null)) as PaystackResponse<T> | null

  if (!response.ok || !payload) {
    logError(
      'paystack.request',
      new Error(`Paystack returned HTTP ${response.status}`),
      { path },
    )

    throw new AppError(ERROR_MESSAGES.paymentFailed, {
      code: 'paystack_http_error',
    })
  }

  return payload
}

const paystackProvider: PaymentProvider = {
  name: 'paystack',
  isMock: false,

  async initialize(params) {
    console.info('[paystack:initialize]', {
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      amountKobo: params.amountKobo,
    })

    const payload = await paystackFetch<PaystackInitializeData>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: params.amountKobo,
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
      },
    )

    if (!payload.status || !payload.data?.authorization_url) {
      logError(
        'paystack.initialize',
        new Error(payload.message || 'Paystack initialization failed'),
        { reference: params.reference },
      )

      throw new AppError(ERROR_MESSAGES.paymentFailed, {
        code: 'paystack_init_failed',
      })
    }

    console.info('[paystack:initialized]', {
      reference: payload.data.reference,
      callbackUrl: params.callbackUrl,
    })

    return {
      provider: 'paystack',
      reference: params.reference,
      authorizationUrl: payload.data.authorization_url,
      providerReference: payload.data.reference,
      raw: {
        access_code: payload.data.access_code,
      },
    }
  },

  async verify(reference) {
    const payload = await paystackFetch<PaystackVerifyData>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    )

    if (!payload.status || !payload.data) {
      logError(
        'paystack.verify',
        new Error(payload.message || 'Paystack verification failed'),
        { reference },
      )

      throw new AppError(ERROR_MESSAGES.paymentFailed, {
        code: 'paystack_verify_failed',
      })
    }

    const data = payload.data

    const status =
      data.status === 'success'
        ? ('succeeded' as const)
        : data.status === 'abandoned'
          ? ('abandoned' as const)
          : data.status === 'ongoing' ||
              data.status === 'pending' ||
              data.status === 'processing'
            ? ('pending' as const)
            : ('failed' as const)

    return {
      provider: 'paystack',
      reference,
      status,
      amountKobo: data.amount ?? 0,
      channel: data.channel ?? null,
      paidAt: data.paid_at ?? null,
      providerReference: data.id
        ? String(data.id)
        : data.reference ?? null,
      failureReason:
        status === 'succeeded'
          ? null
          : data.gateway_response ?? payload.message,
      raw: {
        gateway_response: data.gateway_response ?? null,
        paystack_status: data.status ?? null,
      },
    }
  },
}

/* -------------------------------------------------------------------------- */
/* Provider selection                                                         */
/* -------------------------------------------------------------------------- */

export function getPaymentProvider(): PaymentProvider {
  return getPaymentMode() === 'paystack'
    ? paystackProvider
    : mockProvider
}

export function getPaymentProviderByName(
  name: PaymentProviderName,
): PaymentProvider {
  if (name === 'paystack') return paystackProvider
  if (name === 'mock') return mockProvider

  throw new AppError(ERROR_MESSAGES.paymentFailed, {
    code: 'unsupported_payment_provider',
  })
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

export function buildPaymentReference(taskReference: string) {
  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()

  const cleanedTaskReference = taskReference.replace(
    /[^A-Z0-9]/gi,
    '',
  )

  return `CGP-${cleanedTaskReference}-${Date.now()
    .toString(36)
    .toUpperCase()}-${random}`
}

/**
 * Validates the HMAC SHA-512 signature sent by Paystack webhooks.
 */
export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
) {
  if (!signature) return false

  const { createHmac, timingSafeEqual } = await import('node:crypto')
  const secretKey = requireServerEnv('PAYSTACK_SECRET_KEY')

  const expectedSignature = createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex')

  if (expectedSignature.length !== signature.length) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(expectedSignature, 'utf8'),
    Buffer.from(signature, 'utf8'),
  )
}
