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

export function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
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

/**
 * Resolve the payment mode. Paystack is only selected when the mode asks for it
 * AND a secret key exists, so a half-configured deployment degrades to the
 * clearly-labelled development flow instead of failing at checkout.
 */
export function getPaymentMode(): PaymentMode {
  const requested = (process.env.PAYMENT_MODE ?? 'mock').toLowerCase()
  if (requested === 'paystack' && process.env.PAYSTACK_SECRET_KEY) return 'paystack'
  return 'mock'
}

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && publicEnv.paystackPublicKey)
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
