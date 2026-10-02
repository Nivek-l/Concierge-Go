import 'server-only'

import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type {
  AgentDashboardStats,
  AgentRow,
  AgentServiceAreaRow,
  AgentVerificationRow,
  AvailableTaskRow,
  TaskAssignmentRow,
  TaskStatus,
  VerificationStatus,
} from '@/types/database'
import type { AgentDirectoryItem, AssignmentCandidate, TaskListItem } from '@/types/domain'

import { getReferenceMaps } from './reference'

/* -------------------------------------------------------------------------- */
/* Agent's own view                                                           */
/* -------------------------------------------------------------------------- */

export async function getAgentStats(): Promise<AgentDashboardStats | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('agent_dashboard_stats')
    if (error) throw error
    return data as AgentDashboardStats
  } catch (error) {
    logError('agents.getAgentStats', error)
    return null
  }
}

/** The job board. Redacted server-side — area, never street address. */
export async function getAvailableTasks(): Promise<AvailableTaskRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('available_tasks_for_agent')
    if (error) throw error
    return (data ?? []) as AvailableTaskRow[]
  } catch (error) {
    logError('agents.getAvailableTasks', error)
    return []
  }
}

export interface AgentTaskListItem extends TaskListItem {
  assignment_status: TaskAssignmentRow['status']
  agent_payout_kobo: number
  assigned_at: string
}

export async function getAgentTasks(
  agentId: string,
  options?: { statuses?: TaskStatus[]; assignmentStatuses?: TaskAssignmentRow['status'][] },
): Promise<AgentTaskListItem[]> {
  try {
    const supabase = await createClient()

    let assignmentQuery = supabase
      .from('task_assignments')
      .select('id, task_id, status, agent_payout_kobo, assigned_at')
      .eq('agent_id', agentId)
      .order('assigned_at', { ascending: false })

    if (options?.assignmentStatuses?.length) {
      assignmentQuery = assignmentQuery.in('status', options.assignmentStatuses)
    }

    const { data: assignments, error } = await assignmentQuery
    if (error) throw error

    const rows = (assignments ?? []) as Array<{
      id: string
      task_id: string
      status: TaskAssignmentRow['status']
      agent_payout_kobo: number
      assigned_at: string
    }>

    if (rows.length === 0) return []

    let taskQuery = supabase
      .from('tasks')
      .select(
        'id, reference, title, status, urgency, category_id, city_id, location_area, preferred_date, created_at, updated_at, customer_id',
      )
      .in('id', rows.map((row) => row.task_id))

    if (options?.statuses?.length) taskQuery = taskQuery.in('status', options.statuses)

    const { data: tasks } = await taskQuery
    const { categoryById, cityById } = await getReferenceMaps()

    const assignmentByTask = new Map(rows.map((row) => [row.task_id, row]))

    return ((tasks ?? []) as Array<Record<string, unknown>>)
      .map((task): AgentTaskListItem | null => {
        const assignment = assignmentByTask.get(task.id as string)
        if (!assignment) return null

        return {
          id: task.id as string,
          reference: task.reference as string,
          title: task.title as string,
          status: task.status as TaskStatus,
          urgency: task.urgency as TaskListItem['urgency'],
          category_name: categoryById.get(task.category_id as string)?.name ?? 'Task',
          category_slug: categoryById.get(task.category_id as string)?.slug ?? 'other',
          location_area: (task.location_area as string | null) ?? null,
          city_name: task.city_id ? (cityById.get(task.city_id as string)?.name ?? null) : null,
          preferred_date: (task.preferred_date as string | null) ?? null,
          created_at: task.created_at as string,
          updated_at: task.updated_at as string,
          // Agents see their payout, never what the customer paid.
          total_kobo: null,
          assignment_status: assignment.status,
          agent_payout_kobo: assignment.agent_payout_kobo,
          assigned_at: assignment.assigned_at,
        }
      })
      .filter((item): item is AgentTaskListItem => item !== null)
      .sort((a, b) => (a.assigned_at < b.assigned_at ? 1 : -1))
  } catch (error) {
    logError('agents.getAgentTasks', error, { agentId })
    return []
  }
}

export async function getAgentServiceAreas(
  agentId: string,
): Promise<Array<AgentServiceAreaRow & { city_name: string | null }>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('agent_service_areas')
      .select('*')
      .eq('agent_id', agentId)
      .order('area_name', { ascending: true })

    if (error) throw error

    const { cityById } = await getReferenceMaps()
    return ((data ?? []) as AgentServiceAreaRow[]).map((area) => ({
      ...area,
      city_name: cityById.get(area.city_id)?.name ?? null,
    }))
  } catch (error) {
    logError('agents.getAgentServiceAreas', error, { agentId })
    return []
  }
}

export async function getLatestVerification(
  agentId: string,
): Promise<AgentVerificationRow | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('agent_verifications')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AgentVerificationRow>()

    if (error) throw error
    return data ?? null
  } catch (error) {
    logError('agents.getLatestVerification', error, { agentId })
    return null
  }
}

export interface AgentEarningsBreakdown {
  paidOutKobo: number
  pendingKobo: number
  completedCount: number
  activeCount: number
  entries: Array<{
    taskId: string
    reference: string
    title: string
    amountKobo: number
    completedAt: string | null
    status: TaskAssignmentRow['status']
  }>
}

export async function getAgentEarnings(agentId: string): Promise<AgentEarningsBreakdown> {
  const empty: AgentEarningsBreakdown = {
    paidOutKobo: 0,
    pendingKobo: 0,
    completedCount: 0,
    activeCount: 0,
    entries: [],
  }

  try {
    const supabase = await createClient()
    const { data: assignments, error } = await supabase
      .from('task_assignments')
      .select('task_id, status, agent_payout_kobo, completed_at, assigned_at')
      .eq('agent_id', agentId)
      .in('status', ['active', 'completed'])
      .order('assigned_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const rows = (assignments ?? []) as Array<{
      task_id: string
      status: TaskAssignmentRow['status']
      agent_payout_kobo: number
      completed_at: string | null
      assigned_at: string
    }>

    if (rows.length === 0) return empty

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, reference, title, status')
      .in('id', rows.map((row) => row.task_id))

    const taskById = new Map(
      ((tasks ?? []) as Array<{ id: string; reference: string; title: string; status: TaskStatus }>).map(
        (task) => [task.id, task],
      ),
    )

    let paidOutKobo = 0
    let pendingKobo = 0
    let completedCount = 0
    let activeCount = 0

    const entries = rows.map((row) => {
      const task = taskById.get(row.task_id)
      if (row.status === 'completed') {
        paidOutKobo += row.agent_payout_kobo
        completedCount += 1
      } else if (task?.status !== 'cancelled') {
        pendingKobo += row.agent_payout_kobo
        activeCount += 1
      }

      return {
        taskId: row.task_id,
        reference: task?.reference ?? '',
        title: task?.title ?? 'Task',
        amountKobo: row.agent_payout_kobo,
        completedAt: row.completed_at,
        status: row.status,
      }
    })

    return { paidOutKobo, pendingKobo, completedCount, activeCount, entries }
  } catch (error) {
    logError('agents.getAgentEarnings', error, { agentId })
    return empty
  }
}

/* -------------------------------------------------------------------------- */
/* Admin views                                                                */
/* -------------------------------------------------------------------------- */

export async function getAgentDirectory(options?: {
  status?: VerificationStatus | 'all'
  search?: string
}): Promise<AgentDirectoryItem[]> {
  try {
    const supabase = await createClient()

    let query = supabase.from('agents').select('*').order('created_at', { ascending: false })
    if (options?.status && options.status !== 'all') {
      query = query.eq('verification_status', options.status)
    }

    const { data: agents, error } = await query
    if (error) throw error

    const agentRows = (agents ?? []) as AgentRow[]
    if (agentRows.length === 0) return []

    const profileIds = agentRows.map((agent) => agent.profile_id)
    const agentIds = agentRows.map((agent) => agent.id)

    const [profilesResult, areasResult, assignmentsResult, verificationsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, created_at')
        .in('id', profileIds),
      supabase.from('agent_service_areas').select('*').in('agent_id', agentIds),
      supabase
        .from('task_assignments')
        .select('agent_id, status')
        .in('agent_id', agentIds)
        .eq('status', 'active'),
      supabase
        .from('agent_verifications')
        .select('*')
        .in('agent_id', agentIds)
        .order('created_at', { ascending: false }),
    ])

    const { cityById } = await getReferenceMaps()

    const profileById = new Map(
      ((profilesResult.data ?? []) as AgentDirectoryItem['profile'][]).map((profile) => [
        profile.id,
        profile,
      ]),
    )

    const areasByAgent = new Map<string, Array<AgentServiceAreaRow & { city_name: string | null }>>()
    for (const area of (areasResult.data ?? []) as AgentServiceAreaRow[]) {
      const list = areasByAgent.get(area.agent_id) ?? []
      list.push({ ...area, city_name: cityById.get(area.city_id)?.name ?? null })
      areasByAgent.set(area.agent_id, list)
    }

    const activeByAgent = new Map<string, number>()
    for (const assignment of (assignmentsResult.data ?? []) as Array<{ agent_id: string }>) {
      activeByAgent.set(assignment.agent_id, (activeByAgent.get(assignment.agent_id) ?? 0) + 1)
    }

    const verificationByAgent = new Map<string, AgentVerificationRow>()
    for (const verification of (verificationsResult.data ?? []) as AgentVerificationRow[]) {
      if (!verificationByAgent.has(verification.agent_id)) {
        verificationByAgent.set(verification.agent_id, verification)
      }
    }

    const search = options?.search?.trim().toLowerCase()

    return agentRows
      .map((agent) => {
        const profile = profileById.get(agent.profile_id)
        if (!profile) return null

        return {
          agent,
          profile,
          serviceAreas: areasByAgent.get(agent.id) ?? [],
          activeTaskCount: activeByAgent.get(agent.id) ?? 0,
          latestVerification: verificationByAgent.get(agent.id) ?? null,
        } satisfies AgentDirectoryItem
      })
      .filter((item): item is AgentDirectoryItem => item !== null)
      .filter((item) => {
        if (!search) return true
        return (
          item.profile.full_name.toLowerCase().includes(search) ||
          item.profile.email.toLowerCase().includes(search) ||
          (item.profile.phone ?? '').includes(search)
        )
      })
  } catch (error) {
    logError('agents.getAgentDirectory', error)
    return []
  }
}

/**
 * Candidates for the assignment panel: who can do this, where they work, how
 * busy they are, and how they have performed.
 */
export async function getAssignmentCandidates(task: {
  city_id: string | null
  location_area: string | null
}): Promise<AssignmentCandidate[]> {
  try {
    const directory = await getAgentDirectory({ status: 'verified' })
    const area = task.location_area?.trim().toLowerCase()

    return directory.map((item) => {
      const areaNames = item.serviceAreas.map((entry) => entry.area_name)
      const coversTaskCity = task.city_id
        ? item.serviceAreas.some((entry) => entry.city_id === task.city_id)
        : true
      const coversTaskArea = Boolean(
        area && areaNames.some((name) => name.toLowerCase().includes(area) || area.includes(name.toLowerCase())),
      )

      return {
        agentId: item.agent.id,
        fullName: item.profile.full_name,
        avatarUrl: item.profile.avatar_url,
        headline: item.agent.headline,
        rating: Number(item.agent.rating),
        ratingCount: item.agent.rating_count,
        completedTasks: item.agent.completed_tasks,
        activeTaskCount: item.activeTaskCount,
        maxActiveTasks: item.agent.max_active_tasks,
        isAvailable: item.agent.is_available,
        transportMode: item.agent.transport_mode,
        serviceAreas: areaNames,
        coversTaskCity,
        coversTaskArea,
      } satisfies AssignmentCandidate
    })
  } catch (error) {
    logError('agents.getAssignmentCandidates', error)
    return []
  }
}

export async function getAgentDetail(agentId: string) {
  try {
    const supabase = await createClient()

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle<AgentRow>()

    if (error) throw error
    if (!agent) return null

    const [profileResult, areasResult, verificationsResult, assignmentsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', agent.profile_id).maybeSingle(),
      supabase.from('agent_service_areas').select('*').eq('agent_id', agentId),
      supabase
        .from('agent_verifications')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false }),
      supabase
        .from('task_assignments')
        .select('id, task_id, status, agent_payout_kobo, assigned_at, completed_at')
        .eq('agent_id', agentId)
        .order('assigned_at', { ascending: false })
        .limit(25),
    ])

    const { cityById } = await getReferenceMaps()
    const assignments = (assignmentsResult.data ?? []) as Array<{
      id: string
      task_id: string
      status: TaskAssignmentRow['status']
      agent_payout_kobo: number
      assigned_at: string
      completed_at: string | null
    }>

    let tasks: Array<{ id: string; reference: string; title: string; status: TaskStatus }> = []
    if (assignments.length > 0) {
      const { data } = await supabase
        .from('tasks')
        .select('id, reference, title, status')
        .in('id', assignments.map((assignment) => assignment.task_id))
      tasks = (data ?? []) as typeof tasks
    }

    const taskById = new Map(tasks.map((task) => [task.id, task]))

    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, task_id')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      agent,
      profile: profileResult.data as AgentDirectoryItem['profile'] | null,
      serviceAreas: ((areasResult.data ?? []) as AgentServiceAreaRow[]).map((area) => ({
        ...area,
        city_name: cityById.get(area.city_id)?.name ?? null,
      })),
      verifications: (verificationsResult.data ?? []) as AgentVerificationRow[],
      assignments: assignments.map((assignment) => ({
        ...assignment,
        task: taskById.get(assignment.task_id) ?? null,
      })),
      reviews: (reviews ?? []) as Array<{
        id: string
        rating: number
        comment: string | null
        created_at: string
        task_id: string
      }>,
    }
  } catch (error) {
    logError('agents.getAgentDetail', error, { agentId })
    return null
  }
}
