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

/**
 * Operations enters one service charge. The customer-facing quote explains it
 * as 20% transportation and 80% task execution, while the commercial split is
 * independently calculated over the complete service charge.
 */
export function splitServiceCharge(serviceChargeKobo: number) {
  const transportFeeKobo = Math.round(
    serviceChargeKobo * PRICING.transportShareOfServiceCharge,
  )
  const taskExecutionFeeKobo = serviceChargeKobo - transportFeeKobo
  const agentPayoutKobo = Math.round(serviceChargeKobo * PRICING.agentShareOfServiceCharge)

  return {
    transportFeeKobo,
    taskExecutionFeeKobo,
    agentPayoutKobo,
    conciergeShareKobo: serviceChargeKobo - agentPayoutKobo,
  }
}

export function suggestQuote(params: SuggestQuoteParams): QuoteBreakdown {
  const urgencyMultiplier = URGENCY_META[params.urgency].multiplier
  const complexityMultiplier = COMPLEXITY_MULTIPLIER[params.complexity ?? 'medium']

  const serviceFeeKobo = roundToNearestFifty(
    params.baseServiceFeeKobo * urgencyMultiplier * complexityMultiplier,
  )

  // Preserve distance and urgency in the suggested combined service charge;
  // operations still enters only one figure in the quote builder.
  const suggestedTransportKobo = roundToNearestFifty(
    PRICING.transportBaseKobo * (params.destinationRequired ? 1.8 : 1) * urgencyMultiplier,
  )
  const suggestedExecutionKobo = calculatePlatformFee(serviceFeeKobo + suggestedTransportKobo)
  const serviceCharge = splitServiceCharge(suggestedTransportKobo + suggestedExecutionKobo)

  return {
    serviceFeeKobo,
    transportFeeKobo: serviceCharge.transportFeeKobo,
    additionalFeeKobo: 0,
    additionalFeeNote: null,
    platformFeeKobo: serviceCharge.taskExecutionFeeKobo,
    totalKobo: serviceFeeKobo + suggestedTransportKobo + suggestedExecutionKobo,
    agentPayoutKobo: serviceCharge.agentPayoutKobo,
  }
}

/**
 * What the agent earns: 60% of the complete service charge. Transportation is
 * already included in this payout and must not be added to it a second time.
 */
export function suggestAgentPayout(serviceChargeKobo: number) {
  return splitServiceCharge(serviceChargeKobo).agentPayoutKobo
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

  const serviceChargeKobo = breakdown.transportFeeKobo + breakdown.platformFeeKobo
  if (breakdown.agentPayoutKobo !== suggestAgentPayout(serviceChargeKobo)) {
    issues.push({
      field: 'agentPayoutNaira',
      message: 'The Go Agent share must be 60% of the complete service charge.',
    })
  }

  const expectedServiceCharge = calculatePlatformFee(subtotal)
  if (serviceChargeKobo < expectedServiceCharge * 0.5) {
    issues.push({
      field: 'serviceChargeNaira',
      message: 'The total service charge is well below the usual rate for this task.',
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
