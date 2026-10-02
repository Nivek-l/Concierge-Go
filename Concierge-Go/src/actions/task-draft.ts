'use server'

import { revalidatePath } from 'next/cache'

import { requireCustomerAction } from '@/lib/auth'
import { logError, toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { createTaskSchema, fieldErrorsFrom } from '@/lib/validations'
import { interpretTask, toInterpretationRecord } from '@/services/ai'
import { taskEvents } from '@/services/notifications'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { TaskRow } from '@/types/database'

/**
 * Task creation, split into two steps.
 *
 * Storage policies key attachment access off an *existing* task row (the
 * first path segment of the object key). A customer therefore cannot upload
 * a file before the task exists, so the new-task form creates a placeholder
 * `draft` row up front — satisfying every NOT NULL constraint with obviously
 * provisional values — uploads against that id, then `finalizeTaskAction`
 * overwrites it with the real details and moves it to `submitted`.
 *
 * A draft that is never finished simply stays a draft: it is excluded from
 * every customer-facing list and does not count as a real request.
 */

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

export type CreateDraftResult = ActionResult<{ taskId: string }>

export async function createDraftTaskAction(): Promise<CreateDraftResult> {
  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const { data: category } = await supabase
      .from('task_categories')
      .select('id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!category) return actionError('Task categories are not configured yet.')

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        customer_id: user.id,
        category_id: category.id as string,
        title: 'Untitled request',
        description: 'Draft request — details are still being entered.',
        location_address: 'To be provided',
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) throw error

    return actionOk({ taskId: task.id as string })
  } catch (error) {
    logError('taskDraft.create', error)
    return actionError(toUserMessage(error, 'We could not start your request. Please try again.'))
  }
}

export type FinalizeTaskResult = ActionResult<{ taskId: string; reference: string }>

export async function finalizeTaskAction(
  _prev: FinalizeTaskResult | null,
  formData: FormData,
): Promise<FinalizeTaskResult> {
  const raw = readForm(formData)
  const draftTaskId = String(formData.get('draftTaskId') ?? '')

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

  if (!draftTaskId) {
    return actionError('Your request session expired. Please reload the page.')
  }

  const input = parsed.data

  try {
    const user = await requireCustomerAction()
    const supabase = await createClient()

    const { data: draft } = await supabase
      .from('tasks')
      .select('id, customer_id, status')
      .eq('id', draftTaskId)
      .maybeSingle()

    if (!draft || draft.customer_id !== user.id || draft.status !== 'draft') {
      return actionError('This request could not be found. Please start again.')
    }

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

    const interpretation = await interpretTask({
      title: input.title,
      description: input.description,
      categorySlug: input.categorySlug,
      city: city.name as string,
    })

    const { data: task, error } = await supabase
      .from('tasks')
      .update({
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
        location_latitude: input.locationLatitude,
        location_longitude: input.locationLongitude,
        destination_required: input.destinationRequired,
        destination_area: input.destinationArea,
        destination_address: input.destinationAddress,
        destination_latitude: input.destinationLatitude,
        destination_longitude: input.destinationLongitude,
        contact_phone: input.contactPhone ?? user.profile.phone,
        preferred_date: input.preferredDate,
        preferred_time_slot: input.preferredTimeSlot,
        budget_kobo: input.budgetNaira,
        requires_proof: Boolean(category.requires_proof) || interpretation.requiresProof,
        interpretation: toInterpretationRecord(interpretation),
        submitted_at: new Date().toISOString(),
      })
      .eq('id', draftTaskId)
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
      if (attachmentError) {
        logError('taskDraft.finalize.attachments', attachmentError, { taskId: task.id })
      }
    }

    await taskEvents.submitted(task, user.id, user.email)

    revalidatePath('/dashboard')
    revalidatePath('/tasks')
    return actionOk({ taskId: task.id, reference: task.reference })
  } catch (error) {
    logError('taskDraft.finalize', error, { draftTaskId })
    return actionError(
      toUserMessage(error, 'We could not submit your request. Please try again.'),
    )
  }
}
