import { z } from 'zod'

import { isValidNigerianPhone, normalizeNigerianPhone } from '@/lib/format'
import {
  DISPUTE_REASONS,
  PROOF_TYPES,
  TASK_URGENCIES,
  VERIFICATION_STATUSES,
} from '@/types/database'

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export const uuidSchema = z.string().uuid('That reference is not valid.')

export const nigerianPhoneSchema = z
  .string()
  .trim()
  .refine(isValidNigerianPhone, 'Enter a valid Nigerian phone number, e.g. 0803 123 4567.')
  .transform(normalizeNigerianPhone)

export const optionalNigerianPhoneSchema = z
  .union([z.literal(''), nigerianPhoneSchema])
  .optional()
  .transform((value) => (value ? value : null))

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.')
  .toLowerCase()

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Passwords can be at most 72 characters.')
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: 'Include at least one letter and one number.',
  })

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(120, 'That name is too long.')

/** Naira entered by a human, stored as kobo. */
export const nairaAmountSchema = z
  .coerce
  .number({ invalid_type_error: 'Enter an amount in naira.' })
  .min(0, 'Amount cannot be negative.')
  .max(50_000_000, 'That amount is too large. Contact operations for tasks of this size.')
  .transform((naira) => Math.round(naira * 100))

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null))

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: nigerianPhoneSchema,
  password: passwordSchema,
  citySlug: z.string().trim().min(1, 'Choose your city.').default('calabar'),
  area: optionalText(120),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please accept the terms to continue.' }),
  }),
})
export type SignUpInput = z.input<typeof signUpSchema>

export const agentSignUpSchema = signUpSchema.extend({
  transportMode: z.string().trim().min(2, 'How will you move around?').max(60),
})
export type AgentSignUpInput = z.input<typeof agentSignUpSchema>

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
})
export type SignInInput = z.input<typeof signInSchema>

export const forgotPasswordSchema = z.object({ email: emailSchema })
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  })
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>

/* -------------------------------------------------------------------------- */
/* Profile and addresses                                                      */
/* -------------------------------------------------------------------------- */

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  phone: optionalNigerianPhoneSchema,
  citySlug: z.string().trim().optional().nullable(),
  area: optionalText(120),
  avatarUrl: z.string().trim().url('That image link is not valid.').optional().nullable().or(z.literal('')),
})
export type UpdateProfileInput = z.input<typeof updateProfileSchema>

export const addressSchema = z.object({
  id: uuidSchema.optional(),
  label: z.string().trim().min(2, 'Give this address a name, e.g. Home or Office.').max(60),
  streetAddress: z.string().trim().min(5, 'Enter the street address.').max(240),
  area: optionalText(120),
  landmark: optionalText(160),
  citySlug: z.string().trim().min(1, 'Choose a city.'),
  contactName: optionalText(120),
  contactPhone: optionalNigerianPhoneSchema,
  isDefault: z.boolean().default(false),
})
export type AddressInput = z.input<typeof addressSchema>

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export const attachmentMetaSchema = z.object({
  storagePath: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024, 'That file is larger than 25MB.'),
})

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Give your request a short title.')
      .max(140, 'Keep the title under 140 characters.'),
    description: z
      .string()
      .trim()
      .min(20, 'Tell us a bit more — at least 20 characters, so we can quote accurately.')
      .max(4000, 'That is very long. Keep it under 4000 characters.'),
    categorySlug: z.string().trim().min(1, 'Choose a category.'),
    urgency: z.enum(TASK_URGENCIES).default('standard'),
    citySlug: z.string().trim().min(1, 'Choose a city.'),
    locationArea: optionalText(120),
    locationAddress: z.string().trim().min(5, 'Where should the agent go?').max(300),
    locationLandmark: optionalText(160),
    destinationRequired: z.boolean().default(false),
    destinationArea: optionalText(120),
    destinationAddress: optionalText(300),
    contactPhone: optionalNigerianPhoneSchema,
    preferredDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null))
      .refine(
        (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
        'Choose a valid date.',
      ),
    preferredTimeSlot: optionalText(80),
    budgetNaira: z
      .union([z.literal(''), z.coerce.number().min(0).max(50_000_000)])
      .optional()
      .transform((value) =>
        value === '' || value === undefined ? null : Math.round(Number(value) * 100),
      ),
    additionalInstructions: optionalText(2000),
    attachments: z.array(attachmentMetaSchema).max(5, 'Attach at most 5 files.').default([]),
  })
  .refine(
    (data) => !data.destinationRequired || Boolean(data.destinationAddress),
    { message: 'Add the destination address.', path: ['destinationAddress'] },
  )
export type CreateTaskInput = z.input<typeof createTaskSchema>

export const cancelTaskSchema = z.object({
  taskId: uuidSchema,
  reason: z.string().trim().min(5, 'Tell us briefly why.').max(500),
})

/* -------------------------------------------------------------------------- */
/* Quotes                                                                     */
/* -------------------------------------------------------------------------- */

export const createQuoteSchema = z
  .object({
    taskId: uuidSchema,
    serviceFeeNaira: nairaAmountSchema,
    transportFeeNaira: nairaAmountSchema,
    additionalFeeNaira: nairaAmountSchema.default(0),
    additionalFeeNote: optionalText(240),
    platformFeeNaira: nairaAmountSchema,
    agentPayoutNaira: nairaAmountSchema,
    notes: optionalText(1000),
    expiresInHours: z.coerce.number().int().min(1).max(168).default(48),
  })
  .refine((data) => data.serviceFeeNaira > 0, {
    message: 'A service fee is required.',
    path: ['serviceFeeNaira'],
  })
  .refine((data) => data.additionalFeeNaira === 0 || Boolean(data.additionalFeeNote), {
    message: 'Explain what the additional charge covers.',
    path: ['additionalFeeNote'],
  })
  .refine(
    (data) =>
      data.agentPayoutNaira <=
      data.serviceFeeNaira + data.transportFeeNaira + data.additionalFeeNaira,
    {
      message: 'The agent payout cannot exceed the service, transport and additional charges.',
      path: ['agentPayoutNaira'],
    },
  )
export type CreateQuoteInput = z.input<typeof createQuoteSchema>

export const respondToQuoteSchema = z.object({
  quoteId: uuidSchema,
  taskId: uuidSchema,
  decision: z.enum(['accept', 'decline']),
  reason: optionalText(500),
})

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

export const initiatePaymentSchema = z.object({
  taskId: uuidSchema,
})

export const verifyPaymentSchema = z.object({
  reference: z.string().trim().min(4).max(120),
})

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

export const assignAgentSchema = z.object({
  taskId: uuidSchema,
  agentId: uuidSchema,
  note: optionalText(500),
})

export const reassignAgentSchema = assignAgentSchema.extend({
  reason: z.string().trim().min(5, 'Give a reason for the reassignment.').max(500),
})

export const releaseAssignmentSchema = z.object({
  taskId: uuidSchema,
  reason: z.string().trim().min(5, 'Give a reason.').max(500),
})

/* -------------------------------------------------------------------------- */
/* Agent workflow                                                             */
/* -------------------------------------------------------------------------- */

export const advanceTaskSchema = z.object({
  taskId: uuidSchema,
  note: optionalText(500),
})

export const proofSchema = z
  .object({
    taskId: uuidSchema,
    proofType: z.enum(PROOF_TYPES),
    note: optionalText(1000),
    storagePath: z.string().trim().max(400).optional().nullable(),
    fileName: z.string().trim().max(240).optional().nullable(),
    mimeType: z.string().trim().max(120).optional().nullable(),
    sizeBytes: z
      .union([z.literal(''), z.coerce.number().int().positive().max(50 * 1024 * 1024)])
      .optional()
      .transform((value) => (value === '' || value === undefined ? null : Number(value))),
  })
  .refine((data) => data.proofType === 'text' || Boolean(data.storagePath), {
    message: 'Upload the file for this proof type.',
    path: ['storagePath'],
  })
  .refine(
    (data) => data.proofType !== 'text' || (data.note ?? '').trim().length >= 10,
    { message: 'Write at least a sentence describing what was done.', path: ['note'] },
  )
export type ProofInput = z.input<typeof proofSchema>

export const agentAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
})

export const agentProfileSchema = z.object({
  headline: optionalText(120),
  bio: optionalText(1000),
  transportMode: optionalText(60),
  serviceAreas: z
    .array(z.string().trim().min(2).max(120))
    .max(12, 'Up to 12 service areas.')
    .default([]),
  citySlug: z.string().trim().min(1, 'Choose your city.'),
})
export type AgentProfileInput = z.input<typeof agentProfileSchema>

/**
 * Agent verification. Deliberately operational: how they move, when they are
 * free, and a referee. No ID numbers, no BVN, no bank details, no document
 * uploads — the MVP does not need them and should not hold them.
 */
export const agentVerificationSchema = z.object({
  transportMode: z.string().trim().min(2, 'How will you get around?').max(60),
  availability: z.string().trim().min(5, 'When are you generally available?').max(300),
  experience: optionalText(1000),
  motivation: optionalText(1000),
  refereeName: optionalText(120),
  refereePhone: optionalNigerianPhoneSchema,
  consentsToChecks: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the verification checks.' }),
  }),
})
export type AgentVerificationInput = z.input<typeof agentVerificationSchema>

export const reviewVerificationSchema = z.object({
  agentId: uuidSchema,
  verificationId: uuidSchema.optional(),
  status: z.enum(VERIFICATION_STATUSES),
  notes: optionalText(1000),
})

/* -------------------------------------------------------------------------- */
/* Messaging, disputes, reviews                                               */
/* -------------------------------------------------------------------------- */

export const sendMessageSchema = z.object({
  taskId: uuidSchema,
  body: z.string().trim().min(1, 'Type a message.').max(2000, 'Keep messages under 2000 characters.'),
  isInternal: z.boolean().default(false),
})

export const createDisputeSchema = z.object({
  taskId: uuidSchema,
  reason: z.enum(DISPUTE_REASONS),
  description: z
    .string()
    .trim()
    .min(10, 'Tell us what went wrong — at least 10 characters.')
    .max(2000),
  attachment: attachmentMetaSchema.optional().nullable(),
})
export type CreateDisputeInput = z.input<typeof createDisputeSchema>

export const resolveDisputeSchema = z.object({
  disputeId: uuidSchema,
  status: z.enum(['under_review', 'resolved', 'rejected']),
  resolutionNote: z.string().trim().min(5, 'Add a resolution note.').max(2000),
  finalTaskStatus: z.enum(['completed', 'cancelled', 'in_progress']).optional(),
})

export const createReviewSchema = z.object({
  taskId: uuidSchema,
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  comment: optionalText(1000),
})

export const confirmCompletionSchema = z.object({
  taskId: uuidSchema,
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: optionalText(1000),
})

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export const adminUpdateTaskStatusSchema = z.object({
  taskId: uuidSchema,
  status: z.enum([
    'under_review',
    'quoted',
    'awaiting_payment',
    'paid',
    'assigned',
    'in_progress',
    'awaiting_confirmation',
    'completed',
    'cancelled',
    'disputed',
  ]),
  note: optionalText(500),
})

export const suspendAccountSchema = z.object({
  profileId: uuidSchema,
  suspended: z.boolean(),
  reason: optionalText(500),
})

export const taskFilterSchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  urgency: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
})

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Flatten a ZodError into the shape server actions return to forms. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors
  return Object.fromEntries(
    Object.entries(flattened).filter(([, messages]) => Boolean(messages?.length)),
  ) as Record<string, string[]>
}

/** First readable message from a ZodError, for a toast. */
export function firstErrorMessage(error: z.ZodError, fallback = 'Please check the form.') {
  return error.errors[0]?.message ?? fallback
}
