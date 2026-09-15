import { getAiProvider } from '@/lib/env'
import { logError } from '@/lib/errors'
import type { TaskInterpretationRecord } from '@/types/database'

import { deterministicInterpreter } from './deterministic'
import { anthropicInterpreter } from './anthropic'
import { deepSeekInterpreter } from './deepseek'
import { openRouterInterpreter } from './openrouter'
import { CATEGORY_NAMES, type InterpretTaskInput, type TaskInterpretation } from './types'

export type { InterpretTaskInput, TaskInterpretation, TaskComplexity } from './types'
export { CATEGORY_NAMES } from './types'

/**
 * `interpretTask` — the single entry point the application calls.
 *
 *   const reading = await interpretTask({ description: "I need someone to go to
 *     the school and collect my certificate and bring it to me." })
 *
 *   → categorySlug: 'documents-administration'
 *     taskSummary:  'Certificate collection'
 *     actions:      ['Collection', 'Transportation']
 *     complexity:   'medium'
 *     requiresProof: true
 *
 * The deterministic parser is the default and needs no key. When AI_PROVIDER
 * and AI_API_KEY are set the model runs instead — and if it errors or times
 * out, this falls back to the deterministic reading rather than failing the
 * customer's request. Interpretation is advisory: operations always reviews.
 */
export async function interpretTask(input: InterpretTaskInput): Promise<TaskInterpretation> {
  const provider = getAiProvider()

  if (provider === 'anthropic' || provider === 'deepseek' || provider === 'openrouter') {
    try {
      if (provider === 'openrouter') return await openRouterInterpreter.interpret(input)
      if (provider === 'deepseek') return await deepSeekInterpreter.interpret(input)
      return await anthropicInterpreter.interpret(input)
    } catch (error) {
      logError('ai.interpretTask.fallback', error, { provider })
    }
  }

  return deterministicInterpreter.interpret(input)
}

/** Compact form stored on tasks.interpretation. */
export function toInterpretationRecord(
  interpretation: TaskInterpretation,
): TaskInterpretationRecord {
  return {
    provider: interpretation.provider,
    category_slug: interpretation.categorySlug,
    task_summary: interpretation.taskSummary,
    suggested_actions: interpretation.suggestedActions,
    complexity: interpretation.complexity,
    requires_proof: interpretation.requiresProof,
    suggested_urgency: interpretation.suggestedUrgency,
    confidence: interpretation.confidence,
    notes: interpretation.notes.join(' '),
    generated_at: interpretation.generatedAt,
  }
}

export function categoryNameFor(slug: string) {
  return CATEGORY_NAMES[slug] ?? 'Other'
}
