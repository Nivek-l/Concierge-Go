/**
 * Error handling.
 *
 * Rule: users never see a raw database or provider error. Everything is mapped
 * to a sentence that says what happened and what to do next. Details go to the
 * server log.
 */

export const ERROR_MESSAGES = {
  unauthorized: 'You need to sign in to continue.',
  forbidden: 'You do not have access to this.',
  taskNotFound: 'We could not load this task. It may have been removed.',
  taskUnavailable: 'This task is no longer available.',
  agentUnavailable: 'That Go Agent is not available for this task.',
  quoteExpired: 'This quote has expired. Operations will send you a fresh one.',
  quoteNotOpen: 'This quote has already been responded to.',
  paymentFailed: 'The payment did not go through. No money has left your account.',
  paymentNotConfigured: 'Payments are not configured on this deployment yet.',
  uploadFailed: 'That file could not be uploaded. Check the type and size, then try again.',
  proofRequired: 'Proof of completion is required before this task can be closed.',
  loadFailed: 'Something went wrong loading this page. Please try again.',
  saveFailed: 'We could not save that. Please try again.',
  duplicate: 'That already exists.',
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  unknown: 'Something went wrong. Please try again.',
} as const

export class AppError extends Error {
  readonly code: string
  readonly userMessage: string

  constructor(userMessage: string, options?: { code?: string; cause?: unknown }) {
    super(userMessage)
    this.name = 'AppError'
    this.code = options?.code ?? 'app_error'
    this.userMessage = userMessage
    if (options?.cause) this.cause = options.cause
  }
}

interface PostgresLikeError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function asPostgresError(error: unknown): PostgresLikeError | null {
  if (!error || typeof error !== 'object') return null
  const candidate = error as PostgresLikeError
  if (typeof candidate.message !== 'string' && typeof candidate.code !== 'string') return null
  return candidate
}

/**
 * Turn any thrown value into a message that is safe and useful to show.
 *
 * Messages raised deliberately by our own database functions (RAISE ... USING
 * ERRCODE = 'P0001') are authored for humans, so they pass through. Everything
 * else is generalised.
 */
export function toUserMessage(error: unknown, fallback: string = ERROR_MESSAGES.unknown): string {
  if (error instanceof AppError) return error.userMessage

  const pg = asPostgresError(error)
  if (pg) {
    switch (pg.code) {
      case 'P0001':
        // Raised by our own guards with customer-facing wording.
        return capitalise(pg.message ?? fallback)
      case 'P0002':
      case 'PGRST116':
        return ERROR_MESSAGES.taskNotFound
      case '42501':
        return ERROR_MESSAGES.forbidden
      case '23505':
        return ERROR_MESSAGES.duplicate
      case '23503':
        return ERROR_MESSAGES.saveFailed
      case '23514':
        return 'Some of those details are not valid. Please check the form and try again.'
      case '22P02':
        return ERROR_MESSAGES.saveFailed
      default:
        break
    }
    if (pg.message?.toLowerCase().includes('proof of completion')) {
      return ERROR_MESSAGES.proofRequired
    }
  }

  return fallback
}

function capitalise(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Log with enough context to debug, without leaking to the response. */
export function logError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const payload = {
    scope,
    message: error instanceof Error ? error.message : String(error),
    ...(context ?? {}),
  }
  console.error('[concierge-go]', JSON.stringify(payload))
  if (error instanceof Error && error.stack && process.env.NODE_ENV !== 'production') {
    console.error(error.stack)
  }
}
