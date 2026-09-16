'use server'

import { revalidatePath } from 'next/cache'

import { requireCustomerAction, requireUserAction } from '@/lib/auth'
import { AppError, ERROR_MESSAGES, logError, toUserMessage } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  cancelTaskSchema,
  confirmCompletionSchema,
  createDisputeSchema,
  createTaskSchema,
  fieldErrorsFrom,
  respondToQuoteSchema,
  sendMessageSchema,
  uuidSchema,
} from '@/lib/validations'
import { interpretTask, toInterpretationRecord } from '@/services/ai'
import { taskEvents } from '@/services/notifications'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { TaskRow } from '@/types/database'

/**
 * Customer-facing task actions.
 *
 * The pattern throughout: authenticate, validate with Zod, re-read the
 * authoritative row from the database, then act. Nothing about money, status
 * or ownership is ever taken from the request body.
 */

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export type CreateTaskResult = ActionResult<{ taskId: string; reference: string }>

export async function createTaskAction(
  _prev: CreateTaskResult | null,
  formData: FormData,
): Promise<CreateTaskResult> {
  const raw = readForm(formData)

  // Attachments are uploaded straight to Storage by the browser; only their
  // metadata comes through here as JSON.
  let attachments: unknown = []
  const attachmentsRaw = formData.get('attachments')
  if (typeof attachmentsRaw === 'string' && attachmentsRaw.trim()) {
    try {
      attachments = JSON.parse(attachmentsRaw)
    } catch {
      attachments = []
    }
  }

  const parsed = createTaskSchema.safeParse({
    ...raw,
    destinationRequired: raw.destinationRequired === 'on' || raw.destinationRequired === 'true',
    attachments,
  })

  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const input = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const [{ data: category }, { data: city }] = await Promise.all([
      supabase
        .from('task_categories')
        .select('id, slug, requires_proof')
        .eq('slug', input.categorySlug)
        .eq('is_active', true)
        .maybeSingle(),
      supabase.from('cities').select('id, name, is_live').eq('slug', input.citySlug).maybeSingle(),
    ])

    if (!category) {
      return actionError('That category is not available.', {
        fieldErrors: { categorySlug: ['Choose a category.'] },
      })
    }

    if (!city) {
      return actionError('That city is not available.', {
        fieldErrors: { citySlug: ['Choose a city.'] },
      })
    }

    if (!city.is_live) {
      return actionError(
        `Concierge Go is not operating in ${city.name} yet. We are starting in Calabar.`,
        { fieldErrors: { citySlug: ['Not available yet.'] } },
      )
    }

    // Advisory triage: gives operations a head start, never blocks the customer.
    const interpretation = await interpretTask({
      title: input.title,
      description: input.description,
      categorySlug: input.categorySlug,
      city: city.name as string,
    })

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        customer_id: user.id,
        category_id: category.id,
        title: input.title,
        description: input.description,
        additional_instructions: input.additionalInstructions,
        status: 'submitted',
        urgency: input.urgency,
        city_id: city.id,
        location_area: input.locationArea,
        location_address: input.locationAddress,
        location_landmark: input.locationLandmark,
        destination_required: input.destinationRequired,
        destination_area: input.destinationArea,
        destination_address: input.destinationAddress,
        contact_phone: input.contactPhone ?? user.profile.phone,
        preferred_date: input.preferredDate,
        preferred_time_slot: input.preferredTimeSlot,
        budget_kobo: input.budgetNaira,
        // Category policy wins; interpretation can only add a proof requirement.
        requires_proof: Boolean(category.requires_proof) || interpretation.requiresProof,
        interpretation: toInterpretationRecord(interpretation),
        submitted_at: new Date().toISOString(),
      })
      .select('id, reference, title')
      .single<Pick<TaskRow, 'id' | 'reference' | 'title'>>()

    if (error) throw error

    if (input.attachments.length > 0) {
      const { error: attachmentError } = await supabase.from('task_attachments').insert(
        input.attachments.map((file) => ({
          task_id: task.id,
          uploaded_by: user.id,
          kind: 'request' as const,
          bucket: 'task-attachments',
          storage_path: file.storagePath,
          file_name: file.fileName,
          mime_type: file.mimeType,
          size_bytes: file.sizeBytes,
        })),
      )
      // A failed attachment record must not lose the request itself.
      if (attachmentError) {
        logError('tasks.create.attachments', attachmentError, { taskId: task.id })
      }
    }

    await taskEvents.submitted(task, user.id, user.email)

    revalidatePath('/dashboard')
    revalidatePath('/tasks')
    return actionOk({ taskId: task.id, reference: task.reference })
  } catch (error) {
    logError('tasks.create', error)
    return actionError(
      toUserMessage(error, 'We could not submit your request. Please try again.'),
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Quote response                                                             */
/* -------------------------------------------------------------------------- */

export async function respondToQuoteAction(
  formData: FormData,
): Promise<ActionResult<{ status: string }>> {
  const parsed = respondToQuoteSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('That response is not valid.', { fieldErrors: fieldErrorsFrom(parsed.error) })
  }

  const { quoteId, taskId, decision, reason } = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    // Re-read the quote: expiry and status are decided here, not by the client.
    const { data: quote } = await supabase
      .from('task_quotes')
      .select('id, task_id, status, expires_at, total_kobo')
      .eq('id', quoteId)
      .eq('task_id', taskId)
      .maybeSingle()

    if (!quote) return actionError(ERROR_MESSAGES.taskNotFound)
    if (quote.status !== 'sent') return actionError(ERROR_MESSAGES.quoteNotOpen)

    if (new Date(quote.expires_at as string).getTime() < Date.now()) {
      await supabase.from('task_quotes').update({ status: 'expired' }).eq('id', quoteId)
      return actionError(ERROR_MESSAGES.quoteExpired)
    }

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task || task.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)

    if (decision === 'accept') {
      const { error: quoteError } = await supabase
        .from('task_quotes')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', quoteId)

      if (quoteError) throw quoteError

      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'awaiting_payment' })
        .eq('id', taskId)

      if (taskError) throw taskError

      await taskEvents.quoteAccepted(task, user.id, quote.total_kobo as number)

      revalidatePath(`/tasks/${taskId}`)
      revalidatePath('/dashboard')
      return actionOk({ status: 'accepted' }, 'Quote accepted. Payment is the next step.')
    }

    const { error: declineError } = await supabase
      .from('task_quotes')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        decline_reason: reason,
      })
      .eq('id', quoteId)

    if (declineError) throw declineError

    // Back to review so operations can revise rather than losing the request.
    await supabase.from('tasks').update({ status: 'under_review' }).eq('id', taskId)

    await taskEvents.quoteDeclined(task, reason)

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath('/dashboard')
    return actionOk(
      { status: 'declined' },
      'Quote declined. Operations will follow up with you.',
    )
  } catch (error) {
    logError('tasks.respondToQuote', error, { quoteId })
    return actionError(toUserMessage(error, 'We could not record your response.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Completion and disputes                                                    */
/* -------------------------------------------------------------------------- */

export async function confirmCompletionAction(
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const raw = readForm(formData)
  const parsed = confirmCompletionSchema.safeParse({
    ...raw,
    rating: raw.rating ? Number(raw.rating) : undefined,
  })

  if (!parsed.success) {
    return actionError('That confirmation is not valid.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, rating, comment } = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task || task.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)

    if (task.status !== 'awaiting_confirmation') {
      return actionError('This task is not waiting for your confirmation.')
    }

    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('id, agent_id')
      .eq('task_id', taskId)
      .eq('status', 'active')
      .maybeSingle()

    const completedAt = new Date().toISOString()
    const admin = createAdminClient()
    const { data: completedTask, error } = await admin
      .from('tasks')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', taskId)
      .eq('status', 'awaiting_confirmation')
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!completedTask) return actionError('This task has already been updated.')

    let agentProfileId: string | null = null

    if (assignment) {
      const { error: assignmentError } = await admin
        .from('task_assignments')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('id', assignment.id as string)

      if (assignmentError) throw assignmentError

      const { data: agent } = await supabase
        .from('agents')
        .select('profile_id')
        .eq('id', assignment.agent_id as string)
        .maybeSingle()

      agentProfileId = (agent?.profile_id as string | undefined) ?? null

      if (rating) {
        // A trigger recomputes the agent's average from this row.
        const { error: reviewError } = await supabase.from('reviews').insert({
          task_id: taskId,
          customer_id: user.id,
          agent_id: assignment.agent_id as string,
          rating,
          comment,
        })
        if (reviewError) logError('tasks.confirmCompletion.review', reviewError, { taskId })
      }
    }

    await taskEvents.completed(task, user.id, agentProfileId)

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath('/dashboard')
    revalidatePath(`/agent/tasks/${taskId}`)
    revalidatePath('/agent')
    revalidatePath(`/admin/tasks/${taskId}`)
    revalidatePath('/admin')
    return actionOk({ taskId }, 'Task confirmed as complete. Thank you.')
  } catch (error) {
    logError('tasks.confirmCompletion', error, { taskId })
    return actionError(toUserMessage(error, 'We could not confirm completion.'))
  }
}

export type DisputeResult = ActionResult<{ disputeId: string }>

export async function createDisputeAction(
  _prev: DisputeResult | null,
  formData: FormData,
): Promise<DisputeResult> {
  const raw = readForm(formData)

  let attachment: unknown = null
  const attachmentRaw = formData.get('attachment')
  if (typeof attachmentRaw === 'string' && attachmentRaw.trim()) {
    try {
      attachment = JSON.parse(attachmentRaw)
    } catch {
      attachment = null
    }
  }

  const parsed = createDisputeSchema.safeParse({ ...raw, attachment })

  if (!parsed.success) {
    return actionError('Please check the details below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, reason, description } = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task || task.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)

    const disputableStatuses = ['awaiting_confirmation', 'in_progress', 'completed', 'arrived']
    if (!disputableStatuses.includes(task.status)) {
      return actionError('A problem can only be reported once work has started on this task.')
    }

    const { data: existing } = await supabase
      .from('disputes')
      .select('id')
      .eq('task_id', taskId)
      .in('status', ['open', 'under_review'])
      .maybeSingle()

    if (existing) {
      return actionError('You already have an open report on this task. Operations is reviewing it.')
    }

    const { data: dispute, error } = await supabase
      .from('disputes')
      .insert({ task_id: taskId, raised_by: user.id, reason, description, status: 'open' })
      .select('id')
      .single()

    if (error) throw error

    if (parsed.data.attachment) {
      const { error: attachmentError } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        dispute_id: dispute.id as string,
        uploaded_by: user.id,
        kind: 'dispute' as const,
        bucket: 'task-attachments',
        storage_path: parsed.data.attachment.storagePath,
        file_name: parsed.data.attachment.fileName,
        mime_type: parsed.data.attachment.mimeType,
        size_bytes: parsed.data.attachment.sizeBytes,
      })
      if (attachmentError) logError('tasks.createDispute.attachment', attachmentError, { taskId })
    }

    // Only move a live task to disputed; a completed task keeps its status and
    // carries the open dispute alongside it.
    if (task.status !== 'completed') {
      const { error: statusError } = await supabase
        .from('tasks')
        .update({ status: 'disputed' })
        .eq('id', taskId)
      if (statusError) logError('tasks.createDispute.status', statusError, { taskId })
    }

    await taskEvents.disputeCreated(task, user.id)

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath('/dashboard')
    return actionOk({ disputeId: dispute.id as string }, 'We have your report. Operations is on it.')
  } catch (error) {
    logError('tasks.createDispute', error, { taskId })
    return actionError(toUserMessage(error, 'We could not submit your report.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

export async function cancelTaskAction(
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = cancelTaskSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Tell us briefly why you are cancelling.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, reason } = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status')
      .eq('id', taskId)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status'>>()

    if (!task || task.customer_id !== user.id) return actionError(ERROR_MESSAGES.forbidden)

    // Once paid, cancelling involves a refund — that is an operations decision.
    const cancellable = ['draft', 'submitted', 'under_review', 'quoted', 'awaiting_payment']
    if (!cancellable.includes(task.status)) {
      throw new AppError(
        'This task has already been paid for and is being handled. Message operations to cancel it.',
        { code: 'not_cancellable' },
      )
    }

    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', taskId)

    if (error) throw error

    await taskEvents.cancelled(task, [{ profileId: user.id, role: 'customer' }])

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath('/dashboard')
    return actionOk({ taskId }, 'Task cancelled.')
  } catch (error) {
    logError('tasks.cancel', error, { taskId })
    return actionError(toUserMessage(error, 'We could not cancel this task.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Messaging — task-scoped, not an open inbox                                 */
/* -------------------------------------------------------------------------- */

export async function sendMessageAction(
  formData: FormData,
): Promise<ActionResult<{ messageId: string }>> {
  const raw = readForm(formData)
  const parsed = sendMessageSchema.safeParse({
    ...raw,
    isInternal: raw.isInternal === 'on' || raw.isInternal === 'true',
  })

  if (!parsed.success) {
    return actionError('Type a message before sending.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, body, isInternal } = parsed.data

  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    // Only operations can write an internal note.
    const internal = isInternal && user.role === 'admin'

    const { data: message, error } = await supabase
      .from('task_messages')
      .insert({
        task_id: taskId,
        sender_id: user.id,
        sender_role: user.role,
        body,
        is_internal: internal,
      })
      .select('id')
      .single()

    // RLS rejects a sender who is not a participant on this task.
    if (error) throw error

    if (!internal) {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, reference, title, customer_id')
        .eq('id', taskId)
        .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id'>>()

      if (task) {
        const { data: assignment } = await supabase
          .from('task_assignments')
          .select('agent_id')
          .eq('task_id', taskId)
          .eq('status', 'active')
          .maybeSingle()

        let agentProfileId: string | null = null
        if (assignment) {
          const { data: agent } = await supabase
            .from('agents')
            .select('profile_id')
            .eq('id', assignment.agent_id as string)
            .maybeSingle()
          agentProfileId = (agent?.profile_id as string | undefined) ?? null
        }

        // Notify the other side of the conversation.
        if (user.id === task.customer_id && agentProfileId) {
          await taskEvents.messageReceived(task, agentProfileId, user.profile.full_name, body, 'agent')
        } else if (user.id !== task.customer_id) {
          await taskEvents.messageReceived(
            task,
            task.customer_id,
            user.role === 'admin' ? 'Concierge Go' : user.profile.full_name,
            body,
            'customer',
          )
        }
      }
    }

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath(`/agent/tasks/${taskId}`)
    revalidatePath(`/admin/tasks/${taskId}`)
    return actionOk({ messageId: message.id as string })
  } catch (error) {
    logError('tasks.sendMessage', error, { taskId })
    return actionError(toUserMessage(error, 'Your message could not be sent.'))
  }
}

/** Re-signs a private storage object for viewing. */
export async function getAttachmentUrlAction(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  const parsed = uuidSchema.safeParse(attachmentId)
  if (!parsed.success) return actionError('That file is not valid.')

  try {
    await requireUserAction()
    const supabase = await createClient()

    const { data: attachment } = await supabase
      .from('task_attachments')
      .select('bucket, storage_path')
      .eq('id', parsed.data)
      .maybeSingle()

    if (!attachment) return actionError('That file could not be found.')

    const { data, error } = await supabase.storage
      .from(attachment.bucket as string)
      .createSignedUrl(attachment.storage_path as string, 600)

    if (error || !data?.signedUrl) return actionError('That file could not be opened.')

    return actionOk({ url: data.signedUrl })
  } catch (error) {
    logError('tasks.getAttachmentUrl', error)
    return actionError(toUserMessage(error))
  }
}
