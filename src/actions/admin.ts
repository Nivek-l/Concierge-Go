'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminAction } from '@/lib/auth'
import { ERROR_MESSAGES, logError, toUserMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  adminUpdateTaskStatusSchema,
  assignAgentSchema,
  createQuoteSchema,
  fieldErrorsFrom,
  reassignAgentSchema,
  releaseAssignmentSchema,
  resolveDisputeSchema,
  reviewVerificationSchema,
  suspendAccountSchema,
} from '@/lib/validations'
import { computeTotal } from '@/services/pricing'
import { notify, taskEvents } from '@/services/notifications'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { TaskRow, VerificationStatus } from '@/types/database'

/**
 * Operations actions.
 *
 * Every function starts with `requireAdminAction()`. Most writes go through the
 * request-scoped client so the admin RLS policies apply as a second check; the
 * service-role client is used only where a row deliberately has no policy for
 * anyone (payments) or where a write must span another user's records.
 */

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

/* -------------------------------------------------------------------------- */
/* Quotes                                                                     */
/* -------------------------------------------------------------------------- */

export type CreateQuoteResult = ActionResult<{ quoteId: string; totalKobo: number }>

export async function createQuoteAction(
  _prev: CreateQuoteResult | null,
  formData: FormData,
): Promise<CreateQuoteResult> {
  const parsed = createQuoteSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Please check the quote figures.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const input = parsed.data

  try {
    const admin = await requireAdminAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', input.taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task) return actionError(ERROR_MESSAGES.taskNotFound)

    const quotableStatuses = ['submitted', 'under_review', 'quoted']
    if (!quotableStatuses.includes(task.status)) {
      return actionError('This task is past the quoting stage.')
    }

    // Replace any outstanding quote so the customer only ever has one to answer.
    await supabase
      .from('task_quotes')
      .update({ status: 'superseded' })
      .eq('task_id', input.taskId)
      .eq('status', 'sent')

    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString()

    const { data: quote, error } = await supabase
      .from('task_quotes')
      .insert({
        task_id: input.taskId,
        created_by: admin.id,
        service_fee_kobo: input.serviceFeeNaira,
        transport_fee_kobo: input.transportFeeNaira,
        additional_fee_kobo: input.additionalFeeNaira,
        additional_fee_note: input.additionalFeeNote,
        platform_fee_kobo: input.platformFeeNaira,
        agent_payout_kobo: input.agentPayoutNaira,
        status: 'sent',
        notes: input.notes,
        expires_at: expiresAt,
      })
      .select('id, total_kobo')
      .single()

    if (error) throw error

    const { error: statusError } = await supabase
      .from('tasks')
      .update({
        status: 'quoted',
        quoted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', input.taskId)

    if (statusError) throw statusError

    const { data: customer } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', task.customer_id)
      .maybeSingle()

    await taskEvents.quoted(
      task,
      task.customer_id,
      quote.total_kobo as number,
      (customer?.email as string | undefined) ?? null,
      (customer?.phone as string | undefined) ?? null,
    )

    revalidatePath(`/admin/tasks/${input.taskId}`)
    revalidatePath('/admin')
    revalidatePath(`/tasks/${input.taskId}`)

    return actionOk(
      { quoteId: quote.id as string, totalKobo: quote.total_kobo as number },
      'Quote sent to the customer.',
    )
  } catch (error) {
    logError('admin.createQuote', error, { taskId: input.taskId })
    return actionError(toUserMessage(error, 'We could not send that quote.'))
  }
}

/** Server-side total, so the preview a human sees is the number that is stored. */
export async function previewQuoteTotalAction(input: {
  serviceFeeKobo: number
  transportFeeKobo: number
  additionalFeeKobo: number
  platformFeeKobo: number
}): Promise<ActionResult<{ totalKobo: number }>> {
  try {
    await requireAdminAction()
    return actionOk({ totalKobo: computeTotal(input) })
  } catch (error) {
    return actionError(toUserMessage(error))
  }
}

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

export async function assignAgentAction(
  formData: FormData,
): Promise<ActionResult<{ assignmentId: string }>> {
  const parsed = assignAgentSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Choose an agent to assign.', { fieldErrors: fieldErrorsFrom(parsed.error) })
  }

  const { taskId, agentId, note } = parsed.data

  try {
    const admin = await requireAdminAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task) return actionError(ERROR_MESSAGES.taskNotFound)

    if (!['paid', 'assigned'].includes(task.status)) {
      return actionError(
        task.status === 'awaiting_payment'
          ? 'This task has not been paid for yet.'
          : 'This task cannot be assigned at its current stage.',
      )
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('id, profile_id, verification_status, is_available, max_active_tasks')
      .eq('id', agentId)
      .maybeSingle()

    if (!agent) return actionError(ERROR_MESSAGES.agentUnavailable)

    if (agent.verification_status !== 'verified') {
      return actionError('Only verified agents can be assigned a task.')
    }

    const { count: activeCount } = await supabase
      .from('task_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'active')

    if ((activeCount ?? 0) >= (agent.max_active_tasks as number)) {
      return actionError('That agent is already at their active task limit.')
    }

    // Release any existing active assignment first — the partial unique index
    // permits only one.
    await supabase
      .from('task_assignments')
      .update({
        status: 'reassigned',
        released_at: new Date().toISOString(),
        release_reason: note ?? 'Reassigned by operations.',
      })
      .eq('task_id', taskId)
      .eq('status', 'active')

    const { data: quote } = await supabase
      .from('task_quotes')
      .select('agent_payout_kobo')
      .eq('task_id', taskId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: assignment, error } = await supabase
      .from('task_assignments')
      .insert({
        task_id: taskId,
        agent_id: agentId,
        assigned_by: admin.id,
        status: 'active',
        agent_payout_kobo: (quote?.agent_payout_kobo as number | undefined) ?? 0,
        accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    const { error: statusError } = await supabase
      .from('tasks')
      .update({ status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', taskId)

    if (statusError) throw statusError

    const [{ data: agentProfile }, { data: customer }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', agent.profile_id as string).maybeSingle(),
      supabase.from('profiles').select('phone').eq('id', task.customer_id).maybeSingle(),
    ])

    await taskEvents.agentAssigned(
      task,
      task.customer_id,
      agent.profile_id as string,
      (agentProfile?.full_name as string | undefined) ?? 'Your Go Agent',
      (customer?.phone as string | undefined) ?? null,
    )

    revalidatePath(`/admin/tasks/${taskId}`)
    revalidatePath('/admin')
    revalidatePath(`/tasks/${taskId}`)
    revalidatePath('/agent')

    return actionOk({ assignmentId: assignment.id as string }, 'Go Agent assigned.')
  } catch (error) {
    logError('admin.assignAgent', error, { taskId, agentId })
    return actionError(toUserMessage(error, 'We could not assign that agent.'))
  }
}

export async function reassignAgentAction(
  formData: FormData,
): Promise<ActionResult<{ assignmentId: string }>> {
  const parsed = reassignAgentSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Choose an agent and give a reason.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  // Assignment already releases the incumbent; the reason is the difference.
  const form = new FormData()
  form.set('taskId', parsed.data.taskId)
  form.set('agentId', parsed.data.agentId)
  form.set('note', parsed.data.reason)
  return assignAgentAction(form)
}

export async function releaseAssignmentAction(
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = releaseAssignmentSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Give a reason for releasing this agent.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, reason } = parsed.data

  try {
    await requireAdminAction()
    const supabase = await createClient()

    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('id, agent_id')
      .eq('task_id', taskId)
      .eq('status', 'active')
      .maybeSingle()

    if (!assignment) return actionError('There is no agent assigned to this task.')

    const { error } = await supabase
      .from('task_assignments')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
        release_reason: reason,
      })
      .eq('id', assignment.id as string)

    if (error) throw error

    // Back into the pool for reassignment.
    await supabase.from('tasks').update({ status: 'paid', assigned_at: null }).eq('id', taskId)

    const { data: agent } = await supabase
      .from('agents')
      .select('profile_id, released_assignments')
      .eq('id', assignment.agent_id as string)
      .maybeSingle()

    if (agent) {
      const adminClient = createAdminClient()
      await adminClient
        .from('agents')
        .update({ released_assignments: ((agent.released_assignments as number) ?? 0) + 1 })
        .eq('id', assignment.agent_id as string)

      await notify({
        profileId: agent.profile_id as string,
        type: 'task_cancelled',
        title: 'A task was released from you',
        body: reason,
        taskId,
        link: '/agent',
      })
    }

    revalidatePath(`/admin/tasks/${taskId}`)
    revalidatePath('/admin')
    revalidatePath('/agent')
    return actionOk({ taskId }, 'Agent released. The task is back in the pool.')
  } catch (error) {
    logError('admin.releaseAssignment', error, { taskId })
    return actionError(toUserMessage(error, 'We could not release that agent.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Task status and cancellation                                               */
/* -------------------------------------------------------------------------- */

export async function adminUpdateTaskStatusAction(
  formData: FormData,
): Promise<ActionResult<{ status: string }>> {
  const parsed = adminUpdateTaskStatusSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('That status change is not valid.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, status, note } = parsed.data

  try {
    await requireAdminAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task) return actionError(ERROR_MESSAGES.taskNotFound)

    const timestamps: Record<string, Record<string, string | null>> = {
      under_review: { reviewed_at: new Date().toISOString() },
      completed: { completed_at: new Date().toISOString() },
      cancelled: {
        cancelled_at: new Date().toISOString(),
        cancellation_reason: note ?? 'Cancelled by operations.',
      },
    }

    const { error } = await supabase
      .from('tasks')
      .update({ status, ...(timestamps[status] ?? {}) })
      .eq('id', taskId)

    if (error) throw error

    if (status === 'cancelled') {
      const recipients: Array<{ profileId: string; role: 'customer' | 'agent' }> = [
        { profileId: task.customer_id, role: 'customer' },
      ]

      const { data: assignment } = await supabase
        .from('task_assignments')
        .select('agent_id')
        .eq('task_id', taskId)
        .eq('status', 'active')
        .maybeSingle()

      if (assignment) {
        const { data: agent } = await supabase
          .from('agents')
          .select('profile_id')
          .eq('id', assignment.agent_id as string)
          .maybeSingle()

        if (agent) {
          recipients.push({ profileId: agent.profile_id as string, role: 'agent' })
        }

        await supabase
          .from('task_assignments')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            release_reason: 'Task cancelled by operations.',
          })
          .eq('task_id', taskId)
          .eq('status', 'active')
      }

      await taskEvents.cancelled(task, recipients)
    } else {
      await notify({
        profileId: task.customer_id,
        type: 'task_reviewed',
        title: 'Your task was updated',
        body: note ?? `${task.reference} has been updated by Concierge Go operations.`,
        taskId,
        link: `/tasks/${taskId}`,
      })
    }

    revalidatePath(`/admin/tasks/${taskId}`)
    revalidatePath('/admin')
    revalidatePath(`/tasks/${taskId}`)
    return actionOk({ status }, 'Task updated.')
  } catch (error) {
    logError('admin.updateTaskStatus', error, { taskId, status })
    return actionError(toUserMessage(error, 'We could not update that task.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Agent verification and suspension                                          */
/* -------------------------------------------------------------------------- */

export async function reviewVerificationAction(
  formData: FormData,
): Promise<ActionResult<{ status: VerificationStatus }>> {
  const parsed = reviewVerificationSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('That review is not valid.', { fieldErrors: fieldErrorsFrom(parsed.error) })
  }

  const { agentId, verificationId, status, notes } = parsed.data

  try {
    const admin = await requireAdminAction()
    const supabase = await createClient()

    const { data: agent } = await supabase
      .from('agents')
      .select('id, profile_id')
      .eq('id', agentId)
      .maybeSingle()

    if (!agent) return actionError('That agent could not be found.')

    const { error } = await supabase
      .from('agents')
      .update({
        verification_status: status,
        // A suspended agent stops receiving work immediately.
        is_available: status === 'verified',
      })
      .eq('id', agentId)

    if (error) throw error

    if (verificationId) {
      await supabase
        .from('agent_verifications')
        .update({
          status,
          reviewed_by: admin.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', verificationId)
    }

    const messages: Record<VerificationStatus, string> = {
      verified: 'You are verified. You can now accept tasks from the job board.',
      rejected: notes ?? 'Your verification was not approved. You can submit again with more detail.',
      suspended: notes ?? 'Your account has been suspended. Contact operations.',
      pending: 'Your verification is under review.',
    }

    await taskEvents.verificationUpdated(agent.profile_id as string, status, messages[status])

    revalidatePath('/admin/agents')
    revalidatePath(`/admin/agents/${agentId}`)
    revalidatePath('/agent')
    return actionOk({ status }, `Agent marked ${status}.`)
  } catch (error) {
    logError('admin.reviewVerification', error, { agentId })
    return actionError(toUserMessage(error, 'We could not update that agent.'))
  }
}

export async function suspendAccountAction(
  formData: FormData,
): Promise<ActionResult<{ suspended: boolean }>> {
  const raw = readForm(formData)
  const parsed = suspendAccountSchema.safeParse({
    ...raw,
    suspended: raw.suspended === 'on' || raw.suspended === 'true',
  })

  if (!parsed.success) {
    return actionError('That request is not valid.', { fieldErrors: fieldErrorsFrom(parsed.error) })
  }

  const { profileId, suspended, reason } = parsed.data

  try {
    const admin = await requireAdminAction()

    if (profileId === admin.id) {
      return actionError('You cannot suspend your own account.')
    }

    const supabase = await createClient()

    const { data: target } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', profileId)
      .maybeSingle()

    if (!target) return actionError('That account could not be found.')

    if (target.role === 'admin') {
      return actionError('Operations accounts cannot be suspended from here.')
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        is_suspended: suspended,
        suspension_reason: suspended ? (reason ?? 'Suspended by operations.') : null,
      })
      .eq('id', profileId)

    if (error) throw error

    await notify({
      profileId,
      type: 'agent_verification_updated',
      title: suspended ? 'Your account has been suspended' : 'Your account has been restored',
      body: suspended
        ? (reason ?? 'Contact Concierge Go operations for details.')
        : 'You can sign in and use Concierge Go again.',
      link: '/',
    })

    revalidatePath('/admin/customers')
    revalidatePath('/admin/agents')
    return actionOk(
      { suspended },
      suspended ? 'Account suspended.' : 'Account restored.',
    )
  } catch (error) {
    logError('admin.suspendAccount', error, { profileId })
    return actionError(toUserMessage(error, 'We could not update that account.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Disputes                                                                   */
/* -------------------------------------------------------------------------- */

export async function resolveDisputeAction(
  formData: FormData,
): Promise<ActionResult<{ status: string }>> {
  const parsed = resolveDisputeSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Please add a resolution note.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { disputeId, status, resolutionNote, finalTaskStatus } = parsed.data

  try {
    const admin = await requireAdminAction()
    const supabase = await createClient()

    const { data: dispute } = await supabase
      .from('disputes')
      .select('id, task_id, raised_by, status')
      .eq('id', disputeId)
      .maybeSingle()

    if (!dispute) return actionError('That report could not be found.')

    const isClosing = status === 'resolved' || status === 'rejected'

    const { error } = await supabase
      .from('disputes')
      .update({
        status,
        resolution_note: resolutionNote,
        resolved_by: isClosing ? admin.id : null,
        resolved_at: isClosing ? new Date().toISOString() : null,
      })
      .eq('id', disputeId)

    if (error) throw error

    const taskId = dispute.task_id as string

    if (isClosing && finalTaskStatus) {
      const timestamps: Record<string, Record<string, string>> = {
        completed: { completed_at: new Date().toISOString() },
        cancelled: {
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Dispute resolution: ${resolutionNote}`,
        },
      }

      await supabase
        .from('tasks')
        .update({ status: finalTaskStatus, ...(timestamps[finalTaskStatus] ?? {}) })
        .eq('id', taskId)

      if (finalTaskStatus === 'completed') {
        await supabase
          .from('task_assignments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('task_id', taskId)
          .eq('status', 'active')
      }
    }

    if (isClosing) {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, reference, title')
        .eq('id', taskId)
        .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title'>>()

      if (task) {
        await taskEvents.disputeResolved(task, dispute.raised_by as string, resolutionNote)
      }
    }

    revalidatePath('/admin/disputes')
    revalidatePath(`/admin/tasks/${taskId}`)
    revalidatePath(`/tasks/${taskId}`)
    return actionOk({ status }, 'Report updated.')
  } catch (error) {
    logError('admin.resolveDispute', error, { disputeId })
    return actionError(toUserMessage(error, 'We could not update that report.'))
  }
}
