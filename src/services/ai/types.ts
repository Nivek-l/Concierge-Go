import type { TaskUrgency } from '@/types/database'

/**
 * Task interpretation contract.
 *
 * The product promise is "describe what you need in your own words". This
 * layer turns that sentence into structure operations can act on. Today the
 * default implementation is a deterministic rules parser that needs no API key
 * and no network — the application is fully functional without AI.
 *
 * Swapping in a real model is a one-line change in `interpretTask`; every
 * caller works against this interface.
 */

export type TaskComplexity = 'low' | 'medium' | 'high'

export interface TaskInterpretation {
  /** Which implementation produced this. */
  provider: string
  /** Best-guess category slug, matching public.task_categories.slug. */
  categorySlug: string
  categoryName: string
  /** A short restatement: "Certificate collection". */
  taskSummary: string
  /** The real-world actions implied: Collection, Transportation, Payment… */
  suggestedActions: string[]
  complexity: TaskComplexity
  requiresProof: boolean
  suggestedUrgency: TaskUrgency
  /** 0–1. Below ~0.5 the UI should present this as a guess, not a fact. */
  confidence: number
  /** Anything operations should notice — money handling, missing detail. */
  notes: string[]
  generatedAt: string
}

export interface InterpretTaskInput {
  description: string
  title?: string
  /** Category the customer picked, if any — a strong prior. */
  categorySlug?: string | null
  city?: string | null
}

export interface TaskInterpreter {
  readonly name: string
  interpret(input: InterpretTaskInput): Promise<TaskInterpretation>
}

export const CATEGORY_NAMES: Record<string, string> = {
  'documents-administration': 'Documents & Administration',
  'shopping-sourcing': 'Shopping & Sourcing',
  'personal-errands': 'Personal Errands',
  'business-tasks': 'Business Tasks',
  'property-verification': 'Property Verification',
  events: 'Events',
  other: 'Other',
}


export type AiChatRole = 'system' | 'user' | 'assistant'

export interface AiChatMessage {
  role: AiChatRole
  content: string
}

export interface AiTaskDraft {
  title: string
  description: string
  categorySlug: string
  urgency: TaskUrgency
  citySlug: string
  locationAddress: string
  locationArea: string | null
  locationLandmark: string | null
  destinationRequired: boolean
  destinationAddress: string | null
  destinationArea: string | null
  preferredDate: string | null
  preferredTimeSlot: string | null
  budgetNaira: number | null
  additionalInstructions: string | null
  summary: string
  missingFields: string[]
}
