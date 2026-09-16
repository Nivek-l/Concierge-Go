/**
 * Environment access.
 *
 * Public values are read through static `process.env.NEXT_PUBLIC_*` references
 * so Next.js can inline them at build time. Server-only values are read lazily
 * inside functions, so a missing secret never breaks the build — it fails at
 * the point of use with a clear message instead.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  paystackPublicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? '',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '+2347065582830',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'hello@conciergego.ng',
} as const

/** True when Supabase is configured. Used to show setup guidance instead of crashing. */
export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)
}

export function getAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (configuredUrl) {
    let parsed: URL
    try {
      parsed = new URL(configuredUrl)
    } catch {
      throw new Error(
        'NEXT_PUBLIC_APP_URL must be a complete URL such as https://concierge-go-web.vercel.app.',
      )
    }

    if (process.env.NODE_ENV === 'production' && parsed.hostname === 'localhost') {
      throw new Error('NEXT_PUBLIC_APP_URL cannot use localhost in production.')
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('NEXT_PUBLIC_APP_URL must use https in production.')
    }

    // Returning the origin prevents an accidental path or trailing slash from
    // producing a malformed callback URL.
    return parsed.origin
  }

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
  }
  return 'http://localhost:3000'
}


export function requireServerEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Add it to .env.local (see .env.example).`,
    )
  }
  return value
}

export function getServiceRoleKey() {
  return requireServerEnv('SUPABASE_SERVICE_ROLE_KEY')
}

export type PaymentMode = 'mock' | 'paystack'

/** Resolve the requested mode and fail clearly if Paystack is incomplete. */
export function getPaymentMode(): PaymentMode {
  const requested = (process.env.PAYMENT_MODE ?? 'mock').toLowerCase()
  if (requested !== 'mock' && requested !== 'paystack') {
    throw new Error('PAYMENT_MODE must be either mock or paystack.')
  }
  if (requested === 'paystack' && !process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYMENT_MODE is paystack but PAYSTACK_SECRET_KEY is missing.')
  }
  return requested
}

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

export type AiProvider = 'deterministic' | 'anthropic' | 'deepseek' | 'openrouter'

export function getAiProvider(): AiProvider {
  const requested = (process.env.AI_PROVIDER ?? 'deterministic').toLowerCase()
  if (requested === 'openrouter' && process.env.OPENROUTER_API_KEY) return 'openrouter'
  if (requested === 'anthropic' && process.env.AI_API_KEY) return 'anthropic'
  if (requested === 'deepseek' && (process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY)) return 'deepseek'
  return 'deterministic'
}

export const isProduction = process.env.NODE_ENV === 'production'
export const isDevelopment = process.env.NODE_ENV === 'development'
