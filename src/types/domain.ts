import type {
  AddressRow,
  AgentRow,
  AgentServiceAreaRow,
  AgentVerificationRow,
  CityRow,
  DisputeRow,
  PaymentRow,
  ProfileRow,
  ReviewRow,
  TaskAssignmentRow,
  TaskAttachmentRow,
  TaskCategoryRow,
  TaskMessageRow,
  TaskProofRow,
  TaskQuoteRow,
  TaskRow,
  TaskStatus,
  TaskStatusHistoryRow,
  UserRole,
} from './database'

/* -------------------------------------------------------------------------- */
/* Session                                                                    */
/* -------------------------------------------------------------------------- */

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  profile: ProfileRow
  /** Present only for users with the agent role. */
  agent: AgentRow | null
}

/* -------------------------------------------------------------------------- */
/* Composed read models                                                       */
/* -------------------------------------------------------------------------- */

export interface TaskListItem {
  id: string
  reference: string
  title: string
  status: TaskStatus
  urgency: TaskRow['urgency']
  category_name: string
  category_slug: string
  location_area: string | null
  city_name: string | null
  preferred_date: string | null
  created_at: string
  updated_at: string
  total_kobo: number | null
  customer_name?: string
  customer_id?: string
  agent_name?: string | null
  has_open_dispute?: boolean
}

export interface TaskDetail {
  task: TaskRow
  category: TaskCategoryRow
  city: CityRow | null
  quotes: TaskQuoteRow[]
  activeQuote: TaskQuoteRow | null
  acceptedQuote: TaskQuoteRow | null
  payments: PaymentRow[]
  latestPayment: PaymentRow | null
  attachments: TaskAttachmentRow[]
  proofs: TaskProofRow[]
  history: TaskStatusHistoryRow[]
  messages: TaskMessageRow[]
  assignment: TaskAssignmentRow | null
  dispute: DisputeRow | null
  review: ReviewRow | null
}

export interface AgentDirectoryItem {
  agent: AgentRow
  profile: Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'created_at'>
  serviceAreas: Array<AgentServiceAreaRow & { city_name: string | null }>
  activeTaskCount: number
  latestVerification: AgentVerificationRow | null
}

export interface CustomerDirectoryItem {
  profile: ProfileRow
  cityName: string | null
  taskCount: number
  activeTaskCount: number
  completedTaskCount: number
  totalSpentKobo: number
  lastTaskAt: string | null
}

export interface AssignmentCandidate {
  agentId: string
  fullName: string
  avatarUrl: string | null
  headline: string | null
  rating: number
  ratingCount: number
  completedTasks: number
  activeTaskCount: number
  maxActiveTasks: number
  isAvailable: boolean
  transportMode: string | null
  serviceAreas: string[]
  coversTaskCity: boolean
  coversTaskArea: boolean
}

export interface AddressWithCity extends AddressRow {
  city_name: string | null
}

export interface MessageWithSender extends TaskMessageRow {
  sender_name: string
  sender_avatar: string | null
  is_mine: boolean
}

/* -------------------------------------------------------------------------- */
/* Server action envelope                                                     */
/* -------------------------------------------------------------------------- */

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; code?: string }

export function actionOk<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function actionError(
  error: string,
  extra?: { fieldErrors?: Record<string, string[]>; code?: string },
): ActionResult<never> {
  return { ok: false, error, ...extra }
}

/* -------------------------------------------------------------------------- */
/* Quote maths                                                                */
/* -------------------------------------------------------------------------- */

export interface QuoteBreakdown {
  serviceFeeKobo: number
  transportFeeKobo: number
  additionalFeeKobo: number
  additionalFeeNote?: string | null
  platformFeeKobo: number
  totalKobo: number
  agentPayoutKobo: number
}
