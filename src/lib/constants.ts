import type {
  DisputeReason,
  DisputeStatus,
  PaymentStatus,
  ProofType,
  QuoteStatus,
  TaskStatus,
  TaskUrgency,
  VerificationStatus,
} from '@/types/database'

export const APP_NAME = 'Concierge Go'
export const APP_TAGLINE = 'You ask. We handle it.'
export const APP_DESCRIPTION =
  'Concierge Go helps you get real-world tasks done by connecting you with verified local agents in Calabar.'

export const LAUNCH_CITY = {
  slug: 'calabar',
  name: 'Calabar',
  state: 'Cross River State',
  label: 'Calabar, Cross River State',
} as const

export const CURRENCY = { code: 'NGN', symbol: '₦' } as const

export type StatusTone = 'neutral' | 'info' | 'progress' | 'warning' | 'success' | 'danger'

interface TaskStatusMeta {
  /** Short chip label — still plain English, never database terminology. */
  label: string
  /** Sentence shown to the customer: what is happening right now. */
  customerHeadline: string
  /** What happens next, from the customer's point of view. */
  customerNext: string
  /** Label used in agent-facing surfaces. */
  agentLabel: string
  /** Operations wording: describe the customer or agent, never "you". */
  adminHeadline: string
  adminNext: string
  /** Agent wording: actions and expectations for the assigned agent. */
  agentHeadline: string
  agentNext: string
  tone: StatusTone
  /** Roughly how far through the workflow this status sits (0–100). */
  progress: number
}

/**
 * The single source of truth for turning a database status into language a
 * person can act on. Nothing in the UI should print a raw status value.
 */
export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  draft: {
    label: 'Draft',
    customerHeadline: 'This request has not been sent yet.',
    customerNext: 'Finish the details and submit it for review.',
    agentLabel: 'Draft',
    adminHeadline: 'The customer has not submitted this request.',
    adminNext: 'No operations action is needed until the request is submitted.',
    agentHeadline: 'This request is still a draft.',
    agentNext: 'It is not available to agents yet.',
    tone: 'neutral',
    progress: 5,
  },
  submitted: {
    label: 'Request received',
    customerHeadline: 'We have your request.',
    customerNext: 'Operations is reading it now and will come back with a quote.',
    agentLabel: 'Submitted',
    adminHeadline: 'A new customer request needs review.',
    adminNext: 'Review the details, clarify anything missing, then prepare a quote.',
    agentHeadline: 'Operations is reviewing this request.',
    agentNext: 'It is not available to agents yet.',
    tone: 'info',
    progress: 12,
  },
  under_review: {
    label: 'Being reviewed',
    customerHeadline: 'Operations is reviewing your request.',
    customerNext: 'We are working out what this takes and what it should cost.',
    agentLabel: 'Under review',
    adminHeadline: 'This customer request is under review.',
    adminNext: 'Confirm the scope and send an accurate quote to the customer.',
    agentHeadline: 'Operations is preparing this task.',
    agentNext: 'It will become available only after the customer pays.',
    tone: 'info',
    progress: 22,
  },
  quoted: {
    label: 'Quote ready',
    customerHeadline: 'Your quote is ready.',
    customerNext: 'Review the breakdown, then accept or decline it.',
    agentLabel: 'Quoted',
    adminHeadline: 'A quote has been sent to the customer.',
    adminNext: 'The customer can accept or decline it. Revise the quote only when necessary.',
    agentHeadline: 'The customer is reviewing the quote.',
    agentNext: 'The task is not available to agents until payment is confirmed.',
    tone: 'warning',
    progress: 34,
  },
  awaiting_payment: {
    label: 'Awaiting payment',
    customerHeadline: 'You accepted the quote. Payment is the next step.',
    customerNext: 'Pay to release the task to a Go Agent.',
    agentLabel: 'Awaiting payment',
    adminHeadline: 'The customer accepted the quote.',
    adminNext: 'Payment is still outstanding. Assign an agent only after it is confirmed.',
    agentHeadline: 'This task is awaiting customer payment.',
    agentNext: 'It will appear as available after payment is confirmed.',
    tone: 'warning',
    progress: 44,
  },
  paid: {
    label: 'Paid — finding an agent',
    customerHeadline: 'Payment received. We are putting a Go Agent on this.',
    customerNext: 'You will be told who is handling it, with their rating.',
    agentLabel: 'Available',
    adminHeadline: 'Payment has been confirmed.',
    adminNext: 'Assign a verified Go Agent, or leave the task available for an eligible agent.',
    agentHeadline: 'This paid task is available.',
    agentNext: 'Accept it only if you can meet the timing and location requirements.',
    tone: 'progress',
    progress: 54,
  },
  assigned: {
    label: 'Go Agent assigned',
    customerHeadline: 'Your Go Agent has been assigned.',
    customerNext: 'They will set out and you will see each step here.',
    agentLabel: 'Assigned to you',
    adminHeadline: 'A Go Agent is assigned to this task.',
    adminNext: 'Monitor progress and step in only if the customer or agent needs support.',
    agentHeadline: 'This task is assigned to you.',
    agentNext: 'Review the details and mark when you are on your way.',
    tone: 'progress',
    progress: 62,
  },
  en_route: {
    label: 'Agent on the way',
    customerHeadline: 'Your Go Agent is on the way.',
    customerNext: 'We will tell you the moment they arrive.',
    agentLabel: 'On the way',
    adminHeadline: 'The Go Agent is on the way.',
    adminNext: 'The next update should confirm arrival at the task location.',
    agentHeadline: 'You are marked as on the way.',
    agentNext: 'Update the task when you arrive at the location.',
    tone: 'progress',
    progress: 70,
  },
  arrived: {
    label: 'Agent arrived',
    customerHeadline: 'Your Go Agent has arrived at the location.',
    customerNext: 'Work starts next.',
    agentLabel: 'Arrived',
    adminHeadline: 'The Go Agent has arrived.',
    adminNext: 'The agent should start the task and keep the customer informed.',
    agentHeadline: 'You are marked as arrived.',
    agentNext: 'Start the task when you are ready to begin the work.',
    tone: 'progress',
    progress: 76,
  },
  in_progress: {
    label: 'Being handled now',
    customerHeadline: 'Your task is being handled right now.',
    customerNext: 'Your agent will submit proof when the work is done.',
    agentLabel: 'In progress',
    adminHeadline: 'The Go Agent is handling the task.',
    adminNext: 'Proof should be submitted when the work is finished.',
    agentHeadline: 'You are currently handling this task.',
    agentNext: 'Finish the work, upload the required proof, then send it for confirmation.',
    tone: 'progress',
    progress: 84,
  },
  awaiting_confirmation: {
    label: 'Awaiting customer confirmation',
    customerHeadline: 'The work is done and proof has been submitted.',
    customerNext: 'Review the proof, then confirm completion or report a problem.',
    agentLabel: 'Awaiting customer confirmation',
    adminHeadline: 'The agent submitted proof of completion.',
    adminNext: 'The customer must confirm completion or report a problem.',
    agentHeadline: 'Your work is awaiting customer confirmation.',
    agentNext: 'No further action is needed unless the customer or operations contacts you.',
    tone: 'warning',
    progress: 92,
  },
  completed: {
    label: 'Completed',
    customerHeadline: 'This task is complete.',
    customerNext: 'The proof stays here for your records.',
    agentLabel: 'Completed',
    adminHeadline: 'This task has been completed.',
    adminNext: 'The assignment is closed and no longer counts toward the agent’s active workload.',
    agentHeadline: 'This assignment is complete.',
    agentNext: 'It has been removed from your active workload, so you can accept another task.',
    tone: 'success',
    progress: 100,
  },
  cancelled: {
    label: 'Cancelled',
    customerHeadline: 'This request was cancelled.',
    customerNext: 'Nothing further will happen on it. You can submit a new request any time.',
    agentLabel: 'Cancelled',
    adminHeadline: 'This task was cancelled.',
    adminNext: 'Any active agent assignment has been released.',
    agentHeadline: 'This task was cancelled.',
    agentNext: 'It no longer counts toward your active workload.',
    tone: 'neutral',
    progress: 100,
  },
  disputed: {
    label: 'Problem reported',
    customerHeadline: 'You reported a problem. Operations is on it.',
    customerNext: 'A member of the team will review the proof and get back to you.',
    agentLabel: 'Disputed',
    adminHeadline: 'A problem has been reported on this task.',
    adminNext: 'Review the report, messages and proof before deciding the outcome.',
    agentHeadline: 'The customer reported a problem.',
    agentNext: 'Operations is reviewing it. Keep the task records and wait for an update.',
    tone: 'danger',
    progress: 96,
  },
}

/** Statuses that mean "this is live work right now". */
export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  'submitted',
  'under_review',
  'quoted',
  'awaiting_payment',
  'paid',
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'awaiting_confirmation',
]

export const OPEN_TASK_STATUSES: TaskStatus[] = [...ACTIVE_TASK_STATUSES, 'disputed']

export const CLOSED_TASK_STATUSES: TaskStatus[] = ['completed', 'cancelled']

export const AGENT_WORKING_STATUSES: TaskStatus[] = [
  'assigned',
  'en_route',
  'arrived',
  'in_progress',
  'awaiting_confirmation',
]

/** The transitions an agent may drive, in order. */
export const AGENT_NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  assigned: 'en_route',
  en_route: 'arrived',
  arrived: 'in_progress',
  in_progress: 'awaiting_confirmation',
}

export const AGENT_ACTION_LABEL: Partial<Record<TaskStatus, string>> = {
  assigned: "I'm on my way",
  en_route: "I've arrived",
  arrived: 'Start the task',
  in_progress: 'Submit for customer confirmation',
}

/* -------------------------------------------------------------------------- */
/* Urgency                                                                    */
/* -------------------------------------------------------------------------- */

export const URGENCY_META: Record<
  TaskUrgency,
  { label: string; description: string; tone: StatusTone; multiplier: number }
> = {
  standard: {
    label: 'Standard',
    description: 'Handled in the normal queue. Best value.',
    tone: 'neutral',
    multiplier: 1,
  },
  priority: {
    label: 'Priority',
    description: 'Moved ahead of standard requests where an agent is free.',
    tone: 'info',
    multiplier: 1.25,
  },
  urgent: {
    label: 'Urgent',
    description: 'Reviewed immediately. Subject to agent availability — we confirm before you pay.',
    tone: 'warning',
    multiplier: 1.6,
  },
}

export const TIME_SLOTS = [
  'Morning (8am – 12pm)',
  'Afternoon (12pm – 4pm)',
  'Evening (4pm – 7pm)',
  'Any time during the day',
] as const

/* -------------------------------------------------------------------------- */
/* Quotes, payments, proof, disputes, verification                            */
/* -------------------------------------------------------------------------- */

export const QUOTE_STATUS_META: Record<QuoteStatus, { label: string; tone: StatusTone }> = {
  sent: { label: 'Awaiting your decision', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
  superseded: { label: 'Replaced by a newer quote', tone: 'neutral' },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'Not paid yet', tone: 'warning' },
  processing: { label: 'Payment processing', tone: 'info' },
  succeeded: { label: 'Paid', tone: 'success' },
  failed: { label: 'Payment failed', tone: 'danger' },
  abandoned: { label: 'Payment not completed', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'info' },
}

export const PROOF_TYPE_META: Record<
  ProofType,
  { label: string; description: string; icon: string; requiresFile: boolean }
> = {
  photo: {
    label: 'Photo',
    description: 'A picture of the item, document or location.',
    icon: 'Camera',
    requiresFile: true,
  },
  video: {
    label: 'Video',
    description: 'A short clip — useful for property and condition checks.',
    icon: 'Video',
    requiresFile: true,
  },
  receipt: {
    label: 'Receipt',
    description: 'Proof of a payment made on the customer’s behalf.',
    icon: 'ReceiptText',
    requiresFile: true,
  },
  document: {
    label: 'Document',
    description: 'A scan or photo of the collected document.',
    icon: 'FileText',
    requiresFile: true,
  },
  text: {
    label: 'Written confirmation',
    description: 'A written account of what was done. Only where a file is not possible.',
    icon: 'MessageSquare',
    requiresFile: false,
  },
}

export const DISPUTE_REASON_META: Record<DisputeReason, { label: string; description: string }> = {
  not_completed: {
    label: 'The task was not completed',
    description: 'What was asked for did not actually happen.',
  },
  incorrect_item: {
    label: 'Wrong item or wrong outcome',
    description: 'Something was done or bought, but not what was requested.',
  },
  missing_proof: {
    label: 'Proof is missing or unclear',
    description: 'The proof submitted does not show the task was done.',
  },
  agent_issue: {
    label: 'A problem with the Go Agent',
    description: 'Conduct, communication or reliability.',
  },
  other: { label: 'Something else', description: 'Tell us what went wrong.' },
}

export const DISPUTE_STATUS_META: Record<DisputeStatus, { label: string; tone: StatusTone }> = {
  open: { label: 'Open', tone: 'warning' },
  under_review: { label: 'Under review', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
  rejected: { label: 'Not upheld', tone: 'neutral' },
}

export const VERIFICATION_STATUS_META: Record<
  VerificationStatus,
  { label: string; tone: StatusTone; description: string }
> = {
  pending: {
    label: 'Pending verification',
    tone: 'warning',
    description: 'Submitted and waiting for the operations team.',
  },
  verified: {
    label: 'Verified',
    tone: 'success',
    description: 'Eligible for task assignment.',
  },
  rejected: {
    label: 'Not approved',
    tone: 'danger',
    description: 'Not eligible. The agent can submit again with more detail.',
  },
  suspended: {
    label: 'Suspended',
    tone: 'danger',
    description: 'Temporarily blocked from receiving tasks.',
  },
}

/* -------------------------------------------------------------------------- */
/* Public site content                                                        */
/* -------------------------------------------------------------------------- */

export const WORKFLOW_STEPS = [
  {
    key: 'request',
    label: 'Request',
    title: 'Describe what you need',
    body: 'In your own words. No service catalogue to dig through.',
    icon: 'PenLine',
  },
  {
    key: 'quote',
    label: 'Quote',
    title: 'We review and price it',
    body: 'A real person reads your request and sends a transparent breakdown.',
    icon: 'Receipt',
  },
  {
    key: 'pay',
    label: 'Pay',
    title: 'You approve the cost',
    body: 'Nothing starts until you accept the quote and pay.',
    icon: 'CreditCard',
  },
  {
    key: 'track',
    label: 'Track',
    title: 'Follow every step',
    body: 'Assigned, on the way, arrived, in progress — you always know.',
    icon: 'Route',
  },
  {
    key: 'proof',
    label: 'Proof',
    title: 'See that it happened',
    body: 'Photos, receipts, documents or video — attached to your task.',
    icon: 'BadgeCheck',
  },
  {
    key: 'done',
    label: 'Done',
    title: 'You confirm completion',
    body: 'Happy? Confirm. Not happy? Report a problem and we step in.',
    icon: 'CheckCheck',
  },
] as const

export const TRUST_POINTS = [
  {
    title: 'Verified Go Agents',
    body: 'Every agent is vetted and approved by our operations team before they can take a task.',
    icon: 'ShieldCheck',
  },
  {
    title: 'You see the price first',
    body: 'A full breakdown — service, transport, platform fee — before you pay a naira.',
    icon: 'Wallet',
  },
  {
    title: 'Proof, not promises',
    body: 'Tasks close with evidence you can review, and a problem you report reaches a human.',
    icon: 'Camera',
  },
] as const

/* -------------------------------------------------------------------------- */
/* Uploads                                                                    */
/* -------------------------------------------------------------------------- */

export const UPLOAD_LIMITS = {
  attachment: {
    bucket: 'task-attachments',
    maxBytes: 25 * 1024 * 1024,
    accept: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    maxFiles: 5,
    hint: 'Images, PDF or Word documents. Up to 25MB each, 5 files.',
  },
  proof: {
    bucket: 'task-proofs',
    maxBytes: 50 * 1024 * 1024,
    accept: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/heic',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'text/plain',
    ],
    maxFiles: 1,
    hint: 'Photo, video, PDF or scan. Up to 50MB.',
  },
  avatar: {
    bucket: 'avatars',
    maxBytes: 5 * 1024 * 1024,
    accept: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    maxFiles: 1,
    hint: 'Square image works best. PNG, JPG or WebP up to 5MB.',
  },
} as const

export type UploadKind = keyof typeof UPLOAD_LIMITS

/** Signed URL lifetime for private storage objects. */
export const SIGNED_URL_TTL_SECONDS = 60 * 10

/**
 * Platform fee model. Prices are always calculated or confirmed server-side —
 * these values are the starting point operations sees in the quote builder.
 */
export const PRICING = {
  platformFeeRate: 0.1,
  minPlatformFeeKobo: 20000, // ₦200
  agentShareOfServiceFee: 0.75,
  transportBaseKobo: 100000, // ₦1,000 within Calabar
} as const
