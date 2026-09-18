/**
 * Database row shapes.
 *
 * These mirror supabase/migrations/*.sql by hand. The Supabase client is used
 * untyped and every query helper in src/database casts to these interfaces, so
 * the rest of the application is fully typed while remaining resilient to the
 * relationship-inference quirks of generated types.
 *
 * To move to generated types later:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.gen.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = ['customer', 'agent', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const TASK_STATUSES = [
  'draft',
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
  'completed',
  'cancelled',
  'disputed',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_URGENCIES = ['standard', 'priority', 'urgent'] as const
export type TaskUrgency = (typeof TASK_URGENCIES)[number]

export const QUOTE_STATUSES = ['sent', 'accepted', 'declined', 'expired', 'superseded'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'abandoned',
  'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export type PaymentProviderName = 'mock' | 'paystack'

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]

export const DISPUTE_REASONS = [
  'not_completed',
  'incorrect_item',
  'missing_proof',
  'agent_issue',
  'other',
] as const
export type DisputeReason = (typeof DISPUTE_REASONS)[number]

export const PROOF_TYPES = ['photo', 'video', 'receipt', 'document', 'text'] as const
export type ProofType = (typeof PROOF_TYPES)[number]

export type AttachmentKind = 'request' | 'dispute'

export type AssignmentStatus = 'active' | 'released' | 'reassigned' | 'completed'

export const PAYOUT_STATUSES = ['pending', 'approved', 'paid', 'held', 'cancelled'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'task_submitted',
  'task_reviewed',
  'quote_received',
  'quote_accepted',
  'quote_declined',
  'payment_received',
  'agent_assigned',
  'task_started',
  'proof_uploaded',
  'task_completed',
  'task_cancelled',
  'dispute_created',
  'dispute_resolved',
  'message_received',
  'agent_verification_updated',
  'task_available',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

export interface RoleRow {
  key: UserRole
  label: string
  description: string
  can_access_admin: boolean
  can_execute_tasks: boolean
}

export interface CityRow {
  id: string
  slug: string
  name: string
  state: string
  country: string
  timezone: string
  is_live: boolean
  sort_order: number
  created_at: string
}

export interface ProfileRow {
  id: string
  role: UserRole
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  default_city_id: string | null
  default_area: string | null
  is_suspended: boolean
  suspension_reason: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface AddressRow {
  id: string
  profile_id: string
  label: string
  street_address: string
  area: string | null
  landmark: string | null
  city_id: string | null
  contact_name: string | null
  contact_phone: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TaskCategoryRow {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  icon: string
  examples: string[]
  requires_proof: boolean
  typical_service_fee_kobo: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface TaskRow {
  id: string
  reference: string
  customer_id: string
  category_id: string
  title: string
  description: string
  additional_instructions: string | null
  status: TaskStatus
  urgency: TaskUrgency
  city_id: string | null
  location_area: string | null
  location_address: string
  location_landmark: string | null
  destination_required: boolean
  destination_area: string | null
  destination_address: string | null
  contact_phone: string | null
  preferred_date: string | null
  preferred_time_slot: string | null
  budget_kobo: number | null
  requires_proof: boolean
  interpretation: TaskInterpretationRecord | null
  is_demo: boolean
  submitted_at: string | null
  reviewed_at: string | null
  quoted_at: string | null
  paid_at: string | null
  assigned_at: string | null
  started_at: string | null
  proof_submitted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface TaskInterpretationRecord {
  provider: string
  category_slug: string
  task_summary: string
  suggested_actions: string[]
  complexity: 'low' | 'medium' | 'high'
  requires_proof: boolean
  suggested_urgency: TaskUrgency
  confidence: number
  notes?: string
  generated_at: string
}

export interface TaskAttachmentRow {
  id: string
  task_id: string
  dispute_id: string | null
  uploaded_by: string | null
  kind: AttachmentKind
  bucket: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface TaskQuoteRow {
  id: string
  task_id: string
  created_by: string | null
  service_fee_kobo: number
  transport_fee_kobo: number
  additional_fee_kobo: number
  additional_fee_note: string | null
  platform_fee_kobo: number
  total_kobo: number
  agent_payout_kobo: number
  status: QuoteStatus
  notes: string | null
  expires_at: string
  responded_at: string | null
  decline_reason: string | null
  created_at: string
  updated_at: string
}

export interface PaymentRow {
  id: string
  task_id: string
  quote_id: string | null
  customer_id: string
  provider: PaymentProviderName
  reference: string
  provider_reference: string | null
  amount_kobo: number
  currency: string
  status: PaymentStatus
  authorization_url: string | null
  channel: string | null
  paid_at: string | null
  failure_reason: string | null
  provider_payload: Json | null
  created_at: string
  updated_at: string
}

export interface AgentRow {
  id: string
  profile_id: string
  headline: string | null
  bio: string | null
  transport_mode: string | null
  verification_status: VerificationStatus
  is_available: boolean
  max_active_tasks: number
  rating: number
  rating_count: number
  completed_tasks: number
  cancelled_tasks: number
  accepted_assignments: number
  released_assignments: number
  joined_at: string
  created_at: string
  updated_at: string
}

export interface AgentVerificationRow {
  id: string
  agent_id: string
  status: VerificationStatus
  transport_mode: string
  availability: string
  experience: string | null
  motivation: string | null
  referee_name: string | null
  referee_phone: string | null
  consents_to_checks: boolean
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface AgentServiceAreaRow {
  id: string
  agent_id: string
  city_id: string
  area_name: string
  created_at: string
}

export interface TaskAssignmentRow {
  id: string
  task_id: string
  agent_id: string
  assigned_by: string | null
  status: AssignmentStatus
  agent_payout_kobo: number
  assigned_at: string
  accepted_at: string | null
  released_at: string | null
  release_reason: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AgentPayoutRow {
  id: string
  assignment_id: string
  task_id: string
  agent_id: string
  amount_kobo: number
  status: PayoutStatus
  available_at: string
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  payment_reference: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface TaskStatusHistoryRow {
  id: string
  task_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  changed_by: string | null
  actor_role: UserRole | null
  note: string | null
  created_at: string
}

export interface TaskMessageRow {
  id: string
  task_id: string
  sender_id: string
  sender_role: UserRole
  body: string
  is_internal: boolean
  created_at: string
}

export interface TaskProofRow {
  id: string
  task_id: string
  agent_id: string | null
  submitted_by: string | null
  proof_type: ProofType
  note: string | null
  bucket: string
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface NotificationRow {
  id: string
  profile_id: string
  type: NotificationType
  title: string
  body: string
  task_id: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export interface DisputeRow {
  id: string
  task_id: string
  raised_by: string
  reason: DisputeReason
  description: string
  status: DisputeStatus
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewRow {
  id: string
  task_id: string
  customer_id: string
  agent_id: string
  rating: number
  comment: string | null
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* RPC payloads                                                               */
/* -------------------------------------------------------------------------- */

export interface AdminDashboardStats {
  total_customers: number
  total_agents: number
  active_agents: number
  pending_verifications: number
  tasks_total: number
  tasks_awaiting_review: number
  quotes_awaiting_response: number
  tasks_awaiting_payment: number
  tasks_awaiting_assignment: number
  tasks_active: number
  tasks_completed: number
  open_disputes: number
  gross_revenue_kobo: number
  platform_fees_kobo: number
  agent_payouts_kobo: number
}

export interface AgentDashboardStats {
  active_tasks: number
  completed_tasks: number
  earnings_kobo: number
  pending_earnings_kobo: number
  rating: number
  rating_count: number
  verification_status: VerificationStatus
  available_tasks: number
}

export interface AvailableTaskRow {
  id: string
  reference: string
  title: string
  summary: string
  category_name: string
  category_slug: string
  urgency: TaskUrgency
  city_name: string | null
  location_area: string | null
  destination_required: boolean
  preferred_date: string | null
  preferred_time_slot: string | null
  requires_proof: boolean
  agent_payout_kobo: number
  created_at: string
}

export interface TaskParticipantCustomer {
  full_name: string
  phone: string | null
  area: string | null
  email: string | null
  member_since: string
}

export interface TaskParticipantAgent {
  id: string
  full_name: string
  avatar_url: string | null
  phone: string | null
  headline: string | null
  rating: number
  rating_count: number
  completed_tasks: number
  verification_status: VerificationStatus
  transport_mode: string | null
}

export interface TaskParticipants {
  customer?: TaskParticipantCustomer | null
  agent?: TaskParticipantAgent | null
}
