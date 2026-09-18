import 'server-only'

import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type {
  AdminDashboardStats,
  DisputeRow,
  DisputeStatus,
  ProfileRow,
  TaskQuoteRow,
  TaskRow,
  TaskStatus,
} from '@/types/database'
import type { CustomerDirectoryItem, TaskListItem } from '@/types/domain'

import { getReferenceMaps } from './reference'

/**
 * Operations reads.
 *
 * Every function here is called from a page that has already run
 * `requireAdmin()`. RLS enforces it a second time — an admin policy is what
 * makes these queries return anything at all.
 */

export async function getAdminStats(): Promise<AdminDashboardStats | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('admin_dashboard_stats')
    if (error) throw error
    return data as AdminDashboardStats
  } catch (error) {
    logError('admin.getAdminStats', error)
    return null
  }
}

export interface AdminTaskFilters {
  status?: string
  category?: string
  urgency?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface AdminTaskListResult {
  tasks: TaskListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getAdminTasks(filters: AdminTaskFilters = {}): Promise<AdminTaskListResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? 20
  const empty: AdminTaskListResult = { tasks: [], total: 0, page, pageSize, totalPages: 0 }

  try {
    const supabase = await createClient()
    const { categoryById, cityById, categoryBySlug } = await getReferenceMaps()

    let query = supabase
      .from('tasks')
      .select(
        'id, reference, title, status, urgency, category_id, city_id, location_area, preferred_date, created_at, updated_at, customer_id',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'needs_attention') {
        query = query.in('status', ['submitted', 'under_review', 'paid', 'disputed'])
      } else if (filters.status === 'active') {
        query = query.in('status', [
          'assigned',
          'en_route',
          'arrived',
          'in_progress',
          'awaiting_confirmation',
        ])
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters.category && filters.category !== 'all') {
      const category = categoryBySlug.get(filters.category)
      if (category) query = query.eq('category_id', category.id)
    }

    if (filters.urgency && filters.urgency !== 'all') {
      query = query.eq('urgency', filters.urgency)
    }

    const search = filters.search?.trim()
    if (search) {
      // Reference or title. Commas and parens would break PostgREST's or().
      const safe = search.replace(/[,()]/g, ' ')
      query = query.or(`reference.ilike.%${safe}%,title.ilike.%${safe}%`)
    }

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, error, count } = await query
    if (error) throw error

    const rows = (data ?? []) as Array<Record<string, unknown>>
    if (rows.length === 0) return { ...empty, total: count ?? 0, totalPages: 0 }

    const taskIds = rows.map((row) => row.id as string)
    const customerIds = Array.from(new Set(rows.map((row) => row.customer_id as string)))

    const [quotesResult, customersResult, assignmentsResult, disputesResult] = await Promise.all([
      supabase.from('task_quotes').select('task_id, total_kobo, status').in('task_id', taskIds),
      supabase.from('profiles').select('id, full_name').in('id', customerIds),
      supabase
        .from('task_assignments')
        .select('task_id, agent_id')
        .in('task_id', taskIds)
        .eq('status', 'active'),
      supabase
        .from('disputes')
        .select('task_id, status')
        .in('task_id', taskIds)
        .in('status', ['open', 'under_review']),
    ])

    const totalByTask = new Map<string, number>()
    for (const quote of (quotesResult.data ?? []) as Array<{
      task_id: string
      total_kobo: number
      status: string
    }>) {
      if (quote.status === 'accepted' || !totalByTask.has(quote.task_id)) {
        totalByTask.set(quote.task_id, quote.total_kobo)
      }
    }

    const customerById = new Map(
      ((customersResult.data ?? []) as Array<{ id: string; full_name: string }>).map((row) => [
        row.id,
        row.full_name,
      ]),
    )

    const agentIdByTask = new Map(
      ((assignmentsResult.data ?? []) as Array<{ task_id: string; agent_id: string }>).map((row) => [
        row.task_id,
        row.agent_id,
      ]),
    )

    let agentNameById = new Map<string, string>()
    const agentIds = Array.from(new Set(agentIdByTask.values()))
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from('agents')
        .select('id, profile_id')
        .in('id', agentIds)
      const agentRows = (agents ?? []) as Array<{ id: string; profile_id: string }>
      if (agentRows.length > 0) {
        const { data: agentProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', agentRows.map((row) => row.profile_id))
        const nameByProfile = new Map(
          ((agentProfiles ?? []) as Array<{ id: string; full_name: string }>).map((row) => [
            row.id,
            row.full_name,
          ]),
        )
        agentNameById = new Map(
          agentRows.map((row) => [row.id, nameByProfile.get(row.profile_id) ?? 'Agent']),
        )
      }
    }

    const disputedTasks = new Set(
      ((disputesResult.data ?? []) as Array<{ task_id: string }>).map((row) => row.task_id),
    )

    const tasks: TaskListItem[] = rows.map((row) => {
      const agentId = agentIdByTask.get(row.id as string)
      return {
        id: row.id as string,
        reference: row.reference as string,
        title: row.title as string,
        status: row.status as TaskStatus,
        urgency: row.urgency as TaskListItem['urgency'],
        category_name: categoryById.get(row.category_id as string)?.name ?? 'Task',
        category_slug: categoryById.get(row.category_id as string)?.slug ?? 'other',
        location_area: (row.location_area as string | null) ?? null,
        city_name: row.city_id ? (cityById.get(row.city_id as string)?.name ?? null) : null,
        preferred_date: (row.preferred_date as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        total_kobo: totalByTask.get(row.id as string) ?? null,
        customer_id: row.customer_id as string,
        customer_name: customerById.get(row.customer_id as string) ?? 'Customer',
        agent_name: agentId ? (agentNameById.get(agentId) ?? null) : null,
        has_open_dispute: disputedTasks.has(row.id as string),
      }
    })

    const total = count ?? tasks.length
    return { tasks, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  } catch (error) {
    logError('admin.getAdminTasks', error, { filters })
    return empty
  }
}

/** The operations work queue: what needs a human, in priority order. */
export async function getOperationsQueue(): Promise<{
  needsReview: TaskListItem[]
  awaitingQuoteResponse: TaskListItem[]
  needsAssignment: TaskListItem[]
  openDisputes: TaskListItem[]
}> {
  const [review, quoted, assignment, disputes] = await Promise.all([
    getAdminTasks({ status: 'submitted', pageSize: 6 }),
    getAdminTasks({ status: 'quoted', pageSize: 6 }),
    getAdminTasks({ status: 'paid', pageSize: 6 }),
    getAdminTasks({ status: 'disputed', pageSize: 6 }),
  ])

  return {
    needsReview: review.tasks,
    awaitingQuoteResponse: quoted.tasks,
    needsAssignment: assignment.tasks,
    openDisputes: disputes.tasks,
  }
}

export async function getRecentActivity(limit = 12) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('task_status_history')
      .select('id, task_id, from_status, to_status, actor_role, created_at, note')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const rows = (data ?? []) as Array<{
      id: string
      task_id: string
      from_status: TaskStatus | null
      to_status: TaskStatus
      actor_role: string | null
      created_at: string
      note: string | null
    }>

    if (rows.length === 0) return []

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, reference, title')
      .in('id', Array.from(new Set(rows.map((row) => row.task_id))))

    const taskById = new Map(
      ((tasks ?? []) as Array<{ id: string; reference: string; title: string }>).map((task) => [
        task.id,
        task,
      ]),
    )

    return rows.map((row) => ({
      ...row,
      task_reference: taskById.get(row.task_id)?.reference ?? '',
      task_title: taskById.get(row.task_id)?.title ?? 'Task',
    }))
  } catch (error) {
    logError('admin.getRecentActivity', error)
    return []
  }
}

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

export async function getCustomerDirectory(options?: {
  search?: string
  limit?: number
}): Promise<CustomerDirectoryItem[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('profiles')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 100)

    const search = options?.search?.trim()
    if (search) {
      const safe = search.replace(/[,()]/g, ' ')
      query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) throw error

    const profiles = (data ?? []) as ProfileRow[]
    if (profiles.length === 0) return []

    const profileIds = profiles.map((profile) => profile.id)

    const [tasksResult, paymentsResult] = await Promise.all([
      supabase.from('tasks').select('customer_id, status, created_at').in('customer_id', profileIds),
      supabase
        .from('payments')
        .select('customer_id, amount_kobo, status')
        .in('customer_id', profileIds)
        .eq('status', 'succeeded'),
    ])

    const { cityById } = await getReferenceMaps()

    const taskStats = new Map<
      string,
      { total: number; active: number; completed: number; last: string | null }
    >()
    for (const task of (tasksResult.data ?? []) as Array<{
      customer_id: string
      status: TaskStatus
      created_at: string
    }>) {
      const current = taskStats.get(task.customer_id) ?? {
        total: 0,
        active: 0,
        completed: 0,
        last: null,
      }
      current.total += 1
      if (task.status === 'completed') current.completed += 1
      else if (!['cancelled', 'draft'].includes(task.status)) current.active += 1
      if (!current.last || task.created_at > current.last) current.last = task.created_at
      taskStats.set(task.customer_id, current)
    }

    const spendByCustomer = new Map<string, number>()
    for (const payment of (paymentsResult.data ?? []) as Array<{
      customer_id: string
      amount_kobo: number
    }>) {
      spendByCustomer.set(
        payment.customer_id,
        (spendByCustomer.get(payment.customer_id) ?? 0) + payment.amount_kobo,
      )
    }

    return profiles.map((profile) => {
      const stats = taskStats.get(profile.id)
      return {
        profile,
        cityName: profile.default_city_id
          ? (cityById.get(profile.default_city_id)?.name ?? null)
          : null,
        taskCount: stats?.total ?? 0,
        activeTaskCount: stats?.active ?? 0,
        completedTaskCount: stats?.completed ?? 0,
        totalSpentKobo: spendByCustomer.get(profile.id) ?? 0,
        lastTaskAt: stats?.last ?? null,
      }
    })
  } catch (error) {
    logError('admin.getCustomerDirectory', error)
    return []
  }
}

export async function getCustomerDetail(profileId: string) {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle<ProfileRow>()

    if (error) throw error
    if (!profile) return null

    const [tasksResult, paymentsResult, addressesResult] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          'id, reference, title, status, urgency, category_id, city_id, location_area, preferred_date, created_at, updated_at, customer_id',
        )
        .eq('customer_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('payments')
        .select('id, amount_kobo, status, created_at, task_id, provider')
        .eq('customer_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('addresses').select('*').eq('profile_id', profileId),
    ])

    const { categoryById, cityById } = await getReferenceMaps()

    const tasks: TaskListItem[] = ((tasksResult.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: row.id as string,
        reference: row.reference as string,
        title: row.title as string,
        status: row.status as TaskStatus,
        urgency: row.urgency as TaskListItem['urgency'],
        category_name: categoryById.get(row.category_id as string)?.name ?? 'Task',
        category_slug: categoryById.get(row.category_id as string)?.slug ?? 'other',
        location_area: (row.location_area as string | null) ?? null,
        city_name: row.city_id ? (cityById.get(row.city_id as string)?.name ?? null) : null,
        preferred_date: (row.preferred_date as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        total_kobo: null,
      }),
    )

    const payments = (paymentsResult.data ?? []) as Array<{
      id: string
      amount_kobo: number
      status: string
      created_at: string
      task_id: string
      provider: string
    }>

    return {
      profile,
      cityName: profile.default_city_id
        ? (cityById.get(profile.default_city_id)?.name ?? null)
        : null,
      tasks,
      payments,
      addresses: addressesResult.data ?? [],
      totalSpentKobo: payments
        .filter((payment) => payment.status === 'succeeded')
        .reduce((sum, payment) => sum + payment.amount_kobo, 0),
    }
  } catch (error) {
    logError('admin.getCustomerDetail', error, { profileId })
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Quotes and disputes                                                        */
/* -------------------------------------------------------------------------- */

export async function getPendingQuotes(): Promise<
  Array<TaskQuoteRow & { task_reference: string; task_title: string; customer_name: string }>
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('task_quotes')
      .select('*')
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const quotes = (data ?? []) as TaskQuoteRow[]
    if (quotes.length === 0) return []

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id')
      .in('id', quotes.map((quote) => quote.task_id))

    const taskRows = (tasks ?? []) as Array<{
      id: string
      reference: string
      title: string
      customer_id: string
    }>

    const { data: customers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(new Set(taskRows.map((task) => task.customer_id))))

    const customerById = new Map(
      ((customers ?? []) as Array<{ id: string; full_name: string }>).map((row) => [
        row.id,
        row.full_name,
      ]),
    )
    const taskById = new Map(taskRows.map((task) => [task.id, task]))

    return quotes.map((quote) => {
      const task = taskById.get(quote.task_id)
      return {
        ...quote,
        task_reference: task?.reference ?? '',
        task_title: task?.title ?? 'Task',
        customer_name: task ? (customerById.get(task.customer_id) ?? 'Customer') : 'Customer',
      }
    })
  } catch (error) {
    logError('admin.getPendingQuotes', error)
    return []
  }
}

export type DisputeWithContext = DisputeRow & {
  task: Pick<TaskRow, 'id' | 'reference' | 'title' | 'status'> | null
  raised_by_name: string
}

export async function getDisputes(status?: DisputeStatus | 'all'): Promise<DisputeWithContext[]> {
  try {
    const supabase = await createClient()

    let query = supabase.from('disputes').select('*').order('created_at', { ascending: false })
    if (status && status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    const disputes = (data ?? []) as DisputeRow[]
    if (disputes.length === 0) return []

    const [tasksResult, profilesResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, reference, title, status')
        .in('id', disputes.map((dispute) => dispute.task_id)),
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(new Set(disputes.map((dispute) => dispute.raised_by)))),
    ])

    const taskById = new Map(
      ((tasksResult.data ?? []) as Array<Pick<TaskRow, 'id' | 'reference' | 'title' | 'status'>>).map(
        (task) => [task.id, task],
      ),
    )
    const nameById = new Map(
      ((profilesResult.data ?? []) as Array<{ id: string; full_name: string }>).map((row) => [
        row.id,
        row.full_name,
      ]),
    )

    return disputes.map((dispute) => ({
      ...dispute,
      task: taskById.get(dispute.task_id) ?? null,
      raised_by_name: nameById.get(dispute.raised_by) ?? 'Customer',
    }))
  } catch (error) {
    logError('admin.getDisputes', error)
    return []
  }
}
