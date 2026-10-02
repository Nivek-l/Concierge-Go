import 'server-only'

import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { createSignedUrls } from '@/services/storage/signed-urls'
import type {
  DisputeRow,
  PaymentRow,
  TaskAssignmentRow,
  TaskAttachmentRow,
  TaskMessageRow,
  TaskParticipants,
  TaskProofRow,
  TaskQuoteRow,
  TaskRow,
  TaskStatus,
  TaskStatusHistoryRow,
  ReviewRow,
  TaskLiveLocationRow,
} from '@/types/database'
import type { TaskDetail, TaskListItem } from '@/types/domain'

import { getReferenceMaps } from './reference'

/**
 * Task reads.
 *
 * Everything here runs through the request-scoped client, so Row Level
 * Security decides what comes back. A customer calling `getTaskDetail` on
 * someone else's task id gets null, not a leak — no extra filtering needed in
 * the page.
 */

const TASK_LIST_COLUMNS =
  'id, reference, title, status, urgency, category_id, city_id, location_area, preferred_date, created_at, updated_at, customer_id'

interface TaskListRow {
  id: string
  reference: string
  title: string
  status: TaskStatus
  urgency: TaskRow['urgency']
  category_id: string
  city_id: string | null
  location_area: string | null
  preferred_date: string | null
  created_at: string
  updated_at: string
  customer_id: string
}

async function decorateTaskList(rows: TaskListRow[]): Promise<TaskListItem[]> {
  if (rows.length === 0) return []

  const { categoryById, cityById } = await getReferenceMaps()
  const supabase = await createClient()
  const taskIds = rows.map((row) => row.id)

  // One extra query for accepted-quote totals rather than N per row.
  const { data: quotes } = await supabase
    .from('task_quotes')
    .select('task_id, total_kobo, status')
    .in('task_id', taskIds)
    .in('status', ['accepted', 'sent'])

  const totalByTask = new Map<string, number>()
  for (const quote of (quotes ?? []) as Array<{ task_id: string; total_kobo: number; status: string }>) {
    // An accepted quote beats an outstanding one.
    if (quote.status === 'accepted' || !totalByTask.has(quote.task_id)) {
      totalByTask.set(quote.task_id, quote.total_kobo)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    urgency: row.urgency,
    category_name: categoryById.get(row.category_id)?.name ?? 'Task',
    category_slug: categoryById.get(row.category_id)?.slug ?? 'other',
    location_area: row.location_area,
    city_name: row.city_id ? (cityById.get(row.city_id)?.name ?? null) : null,
    preferred_date: row.preferred_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_kobo: totalByTask.get(row.id) ?? null,
    customer_id: row.customer_id,
  }))
}

/* -------------------------------------------------------------------------- */
/* Customer reads                                                             */
/* -------------------------------------------------------------------------- */

export async function getTasksForCustomer(
  customerId: string,
  options?: { statuses?: TaskStatus[]; limit?: number },
): Promise<TaskListItem[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('tasks')
      .select(TASK_LIST_COLUMNS)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (options?.statuses?.length) query = query.in('status', options.statuses)
    if (options?.limit) query = query.limit(options.limit)

    const { data, error } = await query
    if (error) throw error

    return decorateTaskList((data ?? []) as TaskListRow[])
  } catch (error) {
    logError('tasks.getTasksForCustomer', error, { customerId })
    return []
  }
}

export interface CustomerDashboardData {
  activeTasks: TaskListItem[]
  pendingQuotes: TaskListItem[]
  awaitingAction: TaskListItem[]
  completedCount: number
  activeCount: number
  totalCount: number
  recentActivity: Array<{
    id: string
    taskId: string
    taskReference: string
    taskTitle: string
    status: TaskStatus
    createdAt: string
    note: string | null
  }>
}

export async function getCustomerDashboard(customerId: string): Promise<CustomerDashboardData> {
  const empty: CustomerDashboardData = {
    activeTasks: [],
    pendingQuotes: [],
    awaitingAction: [],
    completedCount: 0,
    activeCount: 0,
    totalCount: 0,
    recentActivity: [],
  }

  try {
    const supabase = await createClient()

    const { data: taskRows, error } = await supabase
      .from('tasks')
      .select(TASK_LIST_COLUMNS)
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const tasks = await decorateTaskList((taskRows ?? []) as TaskListRow[])

    const activeTasks = tasks.filter((task) =>
      ['submitted', 'under_review', 'paid', 'assigned', 'en_route', 'arrived', 'in_progress'].includes(
        task.status,
      ),
    )
    const pendingQuotes = tasks.filter((task) => task.status === 'quoted')
    const awaitingAction = tasks.filter((task) =>
      ['awaiting_payment', 'awaiting_confirmation', 'disputed'].includes(task.status),
    )

    // Recent timeline entries across all of this customer's tasks.
    const taskIds = tasks.slice(0, 20).map((task) => task.id)
    let recentActivity: CustomerDashboardData['recentActivity'] = []

    if (taskIds.length > 0) {
      const { data: history } = await supabase
        .from('task_status_history')
        .select('id, task_id, to_status, note, created_at')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false })
        .limit(8)

      const taskById = new Map(tasks.map((task) => [task.id, task]))
      recentActivity = ((history ?? []) as Array<{
        id: string
        task_id: string
        to_status: TaskStatus
        note: string | null
        created_at: string
      }>).map((entry) => ({
        id: entry.id,
        taskId: entry.task_id,
        taskReference: taskById.get(entry.task_id)?.reference ?? '',
        taskTitle: taskById.get(entry.task_id)?.title ?? 'Task',
        status: entry.to_status,
        createdAt: entry.created_at,
        note: entry.note,
      }))
    }

    return {
      activeTasks,
      pendingQuotes,
      awaitingAction,
      completedCount: tasks.filter((task) => task.status === 'completed').length,
      activeCount: activeTasks.length + pendingQuotes.length + awaitingAction.length,
      totalCount: tasks.length,
      recentActivity,
    }
  } catch (error) {
    logError('tasks.getCustomerDashboard', error, { customerId })
    return empty
  }
}

/* -------------------------------------------------------------------------- */
/* Task detail                                                                */
/* -------------------------------------------------------------------------- */

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  try {
    const supabase = await createClient()

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle<TaskRow>()

    if (error) throw error
    if (!task) return null

    const { categoryById, cityById } = await getReferenceMaps()

    const [
      quotesResult,
      paymentsResult,
      attachmentsResult,
      proofsResult,
      historyResult,
      messagesResult,
      assignmentResult,
      disputeResult,
      reviewResult,
    ] = await Promise.all([
      supabase.from('task_quotes').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('task_proofs').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('task_status_history').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('task_messages').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase
        .from('task_assignments')
        .select('*')
        .eq('task_id', taskId)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('disputes').select('*').eq('task_id', taskId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('reviews').select('*').eq('task_id', taskId).maybeSingle(),
    ])

    const quotes = (quotesResult.data ?? []) as TaskQuoteRow[]
    const payments = (paymentsResult.data ?? []) as PaymentRow[]

    const category = categoryById.get(task.category_id)
    if (!category) {
      logError('tasks.getTaskDetail.missingCategory', new Error('category not found'), { taskId })
      return null
    }

    return {
      task,
      category,
      city: task.city_id ? (cityById.get(task.city_id) ?? null) : null,
      quotes,
      activeQuote: quotes.find((quote) => quote.status === 'sent') ?? null,
      acceptedQuote: quotes.find((quote) => quote.status === 'accepted') ?? null,
      payments,
      latestPayment: payments[0] ?? null,
      attachments: (attachmentsResult.data ?? []) as TaskAttachmentRow[],
      proofs: (proofsResult.data ?? []) as TaskProofRow[],
      history: (historyResult.data ?? []) as TaskStatusHistoryRow[],
      messages: (messagesResult.data ?? []) as TaskMessageRow[],
      assignment: (assignmentResult.data as TaskAssignmentRow | null) ?? null,
      dispute: (disputeResult.data as DisputeRow | null) ?? null,
      review: (reviewResult.data as ReviewRow | null) ?? null,
    }
  } catch (error) {
    logError('tasks.getTaskDetail', error, { taskId })
    return null
  }
}

/**
 * Participants, redacted by the database according to who is asking. An agent
 * gets the customer's name and phone but never their email.
 */
export async function getTaskParticipants(taskId: string): Promise<TaskParticipants> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('task_participants', { p_task_id: taskId })
    if (error) throw error
    return (data ?? {}) as TaskParticipants
  } catch (error) {
    logError('tasks.getTaskParticipants', error, { taskId })
    return {}
  }
}

export async function getTaskLiveLocation(taskId: string): Promise<TaskLiveLocationRow | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('task_live_locations').select('*').eq('task_id', taskId).maybeSingle()
    if (error) throw error
    return data as TaskLiveLocationRow | null
  } catch (error) {
    logError('tasks.getTaskLiveLocation', error, { taskId })
    return null
  }
}

/** Signed URLs for a task's attachments and proofs, keyed by storage path. */
export async function getTaskFileUrls(detail: TaskDetail): Promise<Record<string, string>> {
  const files = [
    ...detail.attachments.map((item) => ({ bucket: item.bucket, storage_path: item.storage_path })),
    ...detail.proofs.map((item) => ({ bucket: item.bucket, storage_path: item.storage_path })),
  ]
  return createSignedUrls(files)
}

/** Sender display names for a task's messages. */
export async function getMessageSenders(
  messages: TaskMessageRow[],
): Promise<Map<string, { full_name: string; avatar_url: string | null }>> {
  const senderIds = Array.from(new Set(messages.map((message) => message.sender_id)))
  if (senderIds.length === 0) return new Map()

  try {
    const supabase = await createClient()
    // task_participants covers the common case; this RPC-free lookup is only
    // permitted for admins by RLS, so non-admins fall back to role labels.
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', senderIds)

    return new Map(
      ((data ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null }>).map(
        (row) => [row.id, { full_name: row.full_name, avatar_url: row.avatar_url }],
      ),
    )
  } catch {
    return new Map()
  }
}
