import { requireServerEnv } from '@/lib/env'

import { deterministicInterpreter } from './deterministic'
import {
  CATEGORY_NAMES,
  type InterpretTaskInput,
  type TaskInterpretation,
  type TaskInterpreter,
} from './types'

/**
 * Claude-backed interpreter.
 *
 * Enabled by AI_PROVIDER=anthropic + AI_API_KEY. Called through fetch rather
 * than the SDK so the MVP carries no extra dependency; swap in @anthropic-ai/sdk
 * whenever it earns its place.
 *
 * Two safeguards, because this sits in the customer's submit path:
 *   - a hard timeout, so a slow model never blocks a request
 *   - schema validation on the response, falling back to the deterministic
 *     reading if the model returns anything unexpected
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-5'
const TIMEOUT_MS = 8000

const SYSTEM_PROMPT = `You are the task-triage system for Concierge Go, a Nigerian on-demand task execution platform operating in Calabar, Cross River State.

A customer describes a real-world task in their own words. Convert it into structured triage data for the operations team.

Categories (use the slug exactly):
- documents-administration: collecting/submitting documents, government offices, schools, applications, follow-ups
- shopping-sourcing: buying, sourcing, comparing prices, verifying an item before purchase
- personal-errands: everyday personal errands, bill payments, queuing, drop-offs
- business-tasks: business deliveries, supplier visits, bank runs, corporate registrations
- property-verification: inspecting a property, confirming an address exists, condition reports
- events: venue confirmation, vendor collection, event-day errands
- other: legitimate but does not fit above

Rules:
- Never promise a delivery time.
- requiresProof defaults to true. Only false for a trivial errand with no money and no deliverable.
- complexity: low (single stop, straightforward), medium (a stop plus judgement or waiting), high (multi-stop, negotiation, high value, or official processes).
- suggestedActions: 1-5 short noun phrases like "Collection", "Transportation", "Purchase on your behalf", "Verification", "Photography".
- taskSummary: 2-4 words, e.g. "Certificate collection".
- notes: flag anything operations must confirm (money handling, missing address, unclear timing). Empty array if nothing.
- confidence: 0-1, how sure you are of the category.

Respond with ONLY a JSON object, no prose and no code fences:
{"categorySlug":string,"taskSummary":string,"suggestedActions":string[],"complexity":"low"|"medium"|"high","requiresProof":boolean,"suggestedUrgency":"standard"|"priority"|"urgent","confidence":number,"notes":string[]}`

interface AnthropicTextBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[]
}

function coerceInterpretation(
  parsed: unknown,
  fallback: TaskInterpretation,
): TaskInterpretation {
  if (!parsed || typeof parsed !== 'object') return fallback
  const value = parsed as Record<string, unknown>

  const slug = typeof value.categorySlug === 'string' && value.categorySlug in CATEGORY_NAMES
    ? value.categorySlug
    : fallback.categorySlug

  const complexity =
    value.complexity === 'low' || value.complexity === 'medium' || value.complexity === 'high'
      ? value.complexity
      : fallback.complexity

  const urgency =
    value.suggestedUrgency === 'standard' ||
    value.suggestedUrgency === 'priority' ||
    value.suggestedUrgency === 'urgent'
      ? value.suggestedUrgency
      : fallback.suggestedUrgency

  const actions = Array.isArray(value.suggestedActions)
    ? value.suggestedActions
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 5)
    : fallback.suggestedActions

  const notes = Array.isArray(value.notes)
    ? value.notes.filter((item): item is string => typeof item === 'string').slice(0, 6)
    : []

  const confidence =
    typeof value.confidence === 'number' && value.confidence >= 0 && value.confidence <= 1
      ? Number(value.confidence.toFixed(2))
      : fallback.confidence

  return {
    provider: 'anthropic',
    categorySlug: slug,
    categoryName: CATEGORY_NAMES[slug] ?? 'Other',
    taskSummary:
      typeof value.taskSummary === 'string' && value.taskSummary.trim()
        ? value.taskSummary.trim().slice(0, 80)
        : fallback.taskSummary,
    suggestedActions: actions.length ? actions : fallback.suggestedActions,
    complexity,
    requiresProof:
      typeof value.requiresProof === 'boolean' ? value.requiresProof : fallback.requiresProof,
    suggestedUrgency: urgency,
    confidence,
    notes,
    generatedAt: new Date().toISOString(),
  }
}

/** Models sometimes wrap JSON in prose or fences; take the first object. */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export const anthropicInterpreter: TaskInterpreter = {
  name: 'anthropic',

  async interpret(input: InterpretTaskInput): Promise<TaskInterpretation> {
    const fallback = await deterministicInterpreter.interpret(input)
    const apiKey = requireServerEnv('AI_API_KEY')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || DEFAULT_MODEL,
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                input.title ? `Title: ${input.title}` : null,
                `Description: ${input.description}`,
                input.categorySlug ? `Customer selected category: ${input.categorySlug}` : null,
                input.city ? `City: ${input.city}` : null,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        }),
      })

      if (!response.ok) return fallback

      const payload = (await response.json()) as AnthropicResponse
      const text = payload.content?.find((block) => block.type === 'text')?.text
      if (!text) return fallback

      return coerceInterpretation(extractJson(text), fallback)
    } finally {
      clearTimeout(timeout)
    }
  },
}
