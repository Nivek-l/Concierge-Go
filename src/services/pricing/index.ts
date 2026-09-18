import { PRICING, URGENCY_META } from '@/lib/constants'
import type { TaskUrgency } from '@/types/database'
import type { QuoteBreakdown } from '@/types/domain'

/**
 * Pricing.
 *
 * Concierge Go quotes by hand — a person reads the request and decides. This
 * module produces the *starting numbers* operations sees in the quote builder,
 * and owns the two rules the platform must never get wrong:
 *
 *   1. The task execution fee is derived, not typed.
 *   2. The total is the sum of its parts (the database also computes it as a
 *      generated column, so the two can never disagree).
 *
 * Client-supplied prices are never trusted: server actions recompute from the
 * quote row before any payment is initialised.
 */

export interface SuggestQuoteParams {
  /** From task_categories.typical_service_fee_kobo. */
  baseServiceFeeKobo: number
  urgency: TaskUrgency
  /** Interpretation complexity, when available. */
  complexity?: 'low' | 'medium' | 'high'
  destinationRequired?: boolean
  /** Customer's stated budget, if they gave one. */
  budgetKobo?: number | null
}

const COMPLEXITY_MULTIPLIER: Record<'low' | 'medium' | 'high', number> = {
  low: 0.85,
  medium: 1,
  high: 1.4,
}

/** Round to the nearest ₦50 — Nigerian prices are not quoted to the kobo. */
function roundToNearestFifty(kobo: number) {
  return Math.round(kobo / 5000) * 5000
}

export function calculatePlatformFee(subtotalKobo: number) {
  const derived = Math.round(subtotalKobo * PRICING.platformFeeRate)
  return roundToNearestFifty(Math.max(derived, PRICING.minPlatformFeeKobo))
}

export function suggestQuote(params: SuggestQuoteParams): QuoteBreakdown {
  const urgencyMultiplier = URGENCY_META[params.urgency].multiplier
  const complexityMultiplier = COMPLEXITY_MULTIPLIER[params.complexity ?? 'medium']

  const serviceFeeKobo = roundToNearestFifty(
    params.baseServiceFeeKobo * urgencyMultiplier * complexityMultiplier,
  )

  // A second location means a second trip.
  const transportFeeKobo = roundToNearestFifty(
    PRICING.transportBaseKobo * (params.destinationRequired ? 1.8 : 1) * urgencyMultiplier,
  )

  const subtotal = serviceFeeKobo + transportFeeKobo
  const platformFeeKobo = calculatePlatformFee(subtotal)

  return {
    serviceFeeKobo,
    transportFeeKobo,
    additionalFeeKobo: 0,
    additionalFeeNote: null,
    platformFeeKobo,
    totalKobo: subtotal + platformFeeKobo,
    agentPayoutKobo: suggestAgentPayout(platformFeeKobo),
  }
}

/**
 * What the agent earns: 80% of the variable task execution fee. Transport and
 * other approved task costs stay outside this split.
 */
export function suggestAgentPayout(taskExecutionFeeKobo: number) {
  return Math.round(taskExecutionFeeKobo * PRICING.agentShareOfTaskExecutionFee)
}

export function computeTotal(breakdown: Omit<QuoteBreakdown, 'totalKobo' | 'agentPayoutKobo'>) {
  return (
    breakdown.serviceFeeKobo +
    breakdown.transportFeeKobo +
    breakdown.additionalFeeKobo +
    breakdown.platformFeeKobo
  )
}

export interface QuoteValidationIssue {
  field: string
  message: string
}

/**
 * Sanity checks operations sees before sending a quote. These are warnings for
 * a human, not hard blocks — the schema enforces the invariants that matter.
 */
export function reviewQuote(
  breakdown: QuoteBreakdown,
  context: { budgetKobo?: number | null },
): QuoteValidationIssue[] {
  const issues: QuoteValidationIssue[] = []
  const subtotal = breakdown.serviceFeeKobo + breakdown.transportFeeKobo + breakdown.additionalFeeKobo

  if (breakdown.agentPayoutKobo !== suggestAgentPayout(breakdown.platformFeeKobo)) {
    issues.push({
      field: 'agentPayoutNaira',
      message: 'The Go Agent share must be 80% of the task execution fee.',
    })
  }

  const expectedPlatformFee = calculatePlatformFee(subtotal)
  if (breakdown.platformFeeKobo < expectedPlatformFee * 0.5) {
    issues.push({
      field: 'platformFeeNaira',
      message: 'The task execution fee is well below the usual rate for this subtotal.',
    })
  }

  if (context.budgetKobo && breakdown.totalKobo > context.budgetKobo * 1.5) {
    issues.push({
      field: 'serviceFeeNaira',
      message: 'This is more than 50% above the budget the customer gave. Add a note explaining why.',
    })
  }

  if (breakdown.totalKobo === 0) {
    issues.push({ field: 'serviceFeeNaira', message: 'The total cannot be zero.' })
  }

  return issues
}
