'use server'

import { revalidatePath } from 'next/cache'

import { requireAgentAction, requireUserAction } from '@/lib/auth'
import { AGENT_NEXT_STATUS, TASK_STATUS_META } from '@/lib/constants'
import { ERROR_MESSAGES, logError, toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import {
  advanceTaskSchema,
  agentAvailabilitySchema,
  agentBankAccountSchema,
  agentProfileSchema,
  agentVerificationSchema,
  fieldErrorsFrom,
  proofSchema,
  uuidSchema,
} from '@/lib/validations'
import { getPayoutMode } from '@/lib/env'
import {
  createPaystackTransferRecipient,
  listNigerianBanks,
  resolveNigerianBankAccount,
} from '@/services/payouts/paystack'
import { taskEvents } from '@/services/notifications'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { TaskRow, TaskStatus } from '@/types/database'

/**
 * Go Agent actions.
 *
 * The workflow is Assigned → En Route → Arrived → In Progress → Awaiting
 * Confirmation. Agents cannot skip a step, cannot mark a task complete
 * themselves, and cannot reach customer confirmation without proof — the last
 * of which is enforced by a database trigger, not just by this code.
 */

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

/* -------------------------------------------------------------------------- */
/* Claiming work                                                              */
/* -------------------------------------------------------------------------- */

export async function acceptTaskAction(
  taskId: string,
): Promise<ActionResult<{ assignmentId: string }>> {
  const parsed = uuidSchema.safeParse(taskId)
  if (!parsed.success) return actionError('That task is not valid.')

  try {
    await requireAgentAction()
    const supabase = await createClient()

    // A single RPC does the whole claim: verification check, workload cap,
    // service-area check, row lock and status change. A partial unique index on
    // active assignments makes two agents claiming the same task impossible.
    const { data, error } = await supabase.rpc('agent_accept_task', { p_task_id: parsed.data })

    if (error) throw error

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id')
      .eq('id', parsed.data)
      .maybeSingle<Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id'>>()

    if (task) {
      const user = await requireAgentAction()
      const { data: customer } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', task.customer_id)
        .maybeSingle()

      await taskEvents.agentAssigned(
        task,
        task.customer_id,
        user.id,
        user.profile.full_name,
        (customer?.phone as string | undefined) ?? null,
      )
    }

    revalidatePath('/agent')
    revalidatePath('/agent/available')
    revalidatePath(`/agent/tasks/${parsed.data}`)
    return actionOk({ assignmentId: data as string }, 'Task accepted. It is now yours to handle.')
  } catch (error) {
    logError('agent.acceptTask', error, { taskId })
    return actionError(toUserMessage(error, ERROR_MESSAGES.taskUnavailable))
  }
}

/* -------------------------------------------------------------------------- */
/* Advancing the workflow                                                     */
/* -------------------------------------------------------------------------- */

export async function advanceTaskAction(
  formData: FormData,
): Promise<ActionResult<{ status: TaskStatus }>> {
  const parsed = advanceTaskSchema.safeParse(readForm(formData))
  if (!parsed.success) return actionError('That update is not valid.')

  const { taskId } = parsed.data

  try {
    const user = await requireAgentAction()
    const supabase = await createClient()

    const { data: task } = await supabase
      .from('tasks')
      .select('id, reference, title, customer_id, status, requires_proof')
      .eq('id', taskId)
      .maybeSingle<
        Pick<TaskRow, 'id' | 'reference' | 'title' | 'customer_id' | 'status' | 'requires_proof'>
      >()

    if (!task) return actionError(ERROR_MESSAGES.taskNotFound)

    // Confirm this agent actually holds the task.
    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('id')
      .eq('task_id', taskId)
      .eq('agent_id', user.agent.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!assignment) return actionError('This task is not assigned to you.')

    const nextStatus = AGENT_NEXT_STATUS[task.status]
    if (!nextStatus) {
      return actionError('There is no next step for this task right now.')
    }

    // Fail early with a useful message; the database trigger is the real gate.
    if (nextStatus === 'awaiting_confirmation' && task.requires_proof) {
      const { count } = await supabase
        .from('task_proofs')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', taskId)

      if (!count) {
        return actionError(
          'Upload your proof of completion before sending this to the customer.',
        )
      }
    }

    const timestamps: Partial<Record<TaskStatus, Record<string, string>>> = {
      en_route: { started_at: new Date().toISOString() },
      awaiting_confirmation: { proof_submitted_at: new Date().toISOString() },
    }

    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus, ...(timestamps[nextStatus] ?? {}) })
      .eq('id', taskId)

    if (error) throw error

    const meta = TASK_STATUS_META[nextStatus]

    if (nextStatus === 'awaiting_confirmation') {
      const { data: customer } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', task.customer_id)
        .maybeSingle()

      await taskEvents.proofUploaded(
        task,
        task.customer_id,
        (customer?.email as string | undefined) ?? null,
      )
    } else {
      await taskEvents.statusAdvanced(
        task,
        task.customer_id,
        meta.customerHeadline,
        meta.customerNext,
      )
    }

    revalidatePath(`/agent/tasks/${taskId}`)
    revalidatePath('/agent')
    revalidatePath(`/tasks/${taskId}`)

    return actionOk({ status: nextStatus }, `Updated: ${meta.agentLabel}.`)
  } catch (error) {
    logError('agent.advanceTask', error, { taskId })
    return actionError(toUserMessage(error, 'We could not update this task.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Proof of completion                                                        */
/* -------------------------------------------------------------------------- */

export type ProofActionResult = ActionResult<{ proofId: string }>

export async function submitProofAction(
  _prev: ProofActionResult | null,
  formData: FormData,
): Promise<ProofActionResult> {
  const parsed = proofSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Please check the proof details.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const { taskId, proofType, note, storagePath, fileName, mimeType, sizeBytes } = parsed.data

  try {
    const user = await requireAgentAction()
    const supabase = await createClient()

    const { data: assignment } = await supabase
      .from('task_assignments')
      .select('id')
      .eq('task_id', taskId)
      .eq('agent_id', user.agent.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!assignment) return actionError('This task is not assigned to you.')

    const { data: proof, error } = await supabase
      .from('task_proofs')
      .insert({
        task_id: taskId,
        agent_id: user.agent.id,
        submitted_by: user.id,
        proof_type: proofType,
        note,
        bucket: 'task-proofs',
        storage_path: storagePath ?? null,
        file_name: fileName ?? null,
        mime_type: mimeType ?? null,
        size_bytes: sizeBytes,
      })
      .select('id')
      .single()

    if (error) throw error

    revalidatePath(`/agent/tasks/${taskId}`)
    revalidatePath(`/tasks/${taskId}`)

    return actionOk(
      { proofId: proof.id as string },
      'Proof added. Send the task for customer confirmation when you are done.',
    )
  } catch (error) {
    logError('agent.submitProof', error, { taskId })
    return actionError(toUserMessage(error, ERROR_MESSAGES.uploadFailed))
  }
}

/* -------------------------------------------------------------------------- */
/* Agent profile and availability                                             */
/* -------------------------------------------------------------------------- */

export async function setAvailabilityAction(
  isAvailable: boolean,
): Promise<ActionResult<{ isAvailable: boolean }>> {
  const parsed = agentAvailabilitySchema.safeParse({ isAvailable })
  if (!parsed.success) return actionError('That setting is not valid.')

  try {
    const user = await requireAgentAction()
    const supabase = await createClient()

    const { error } = await supabase
      .from('agents')
      .update({ is_available: parsed.data.isAvailable })
      .eq('id', user.agent.id)

    if (error) throw error

    revalidatePath('/agent')
    return actionOk(
      { isAvailable: parsed.data.isAvailable },
      parsed.data.isAvailable
        ? 'You are available for new tasks.'
        : 'You will not receive new tasks until you turn this back on.',
    )
  } catch (error) {
    logError('agent.setAvailability', error)
    return actionError(toUserMessage(error, ERROR_MESSAGES.saveFailed))
  }
}

export type AgentProfileResult = ActionResult<{ updated: boolean }>

export async function updateAgentProfileAction(
  _prev: AgentProfileResult | null,
  formData: FormData,
): Promise<AgentProfileResult> {
  const raw = readForm(formData)
  const serviceAreas = String(raw.serviceAreas ?? '')
    .split(',')
    .map((area) => area.trim())
    .filter(Boolean)

  const parsed = agentProfileSchema.safeParse({ ...raw, serviceAreas })

  if (!parsed.success) {
    return actionError('Please check the details below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const user = await requireAgentAction()
    const supabase = await createClient()

    // Verification status, rating and task counts are protected by a database
    // trigger — an agent cannot write them however this update is shaped.
    const { error } = await supabase
      .from('agents')
      .update({
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        transport_mode: parsed.data.transportMode,
      })
      .eq('id', user.agent.id)

    if (error) throw error

    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', parsed.data.citySlug)
      .maybeSingle()

    const { error: deleteAreasError } = await supabase
      .from('agent_service_areas')
      .delete()
      .eq('agent_id', user.agent.id)
    if (deleteAreasError) throw deleteAreasError

    if (city && parsed.data.serviceAreas.length > 0) {
      const { error: areaError } = await supabase.from('agent_service_areas').insert(
        parsed.data.serviceAreas.map((area) => ({
          agent_id: user.agent.id,
          city_id: city.id as string,
          area_name: area,
        })),
      )
      if (areaError) throw areaError
    }

    revalidatePath('/agent/profile')
    revalidatePath('/agent')
    return actionOk({ updated: true }, 'Your agent profile has been updated.')
  } catch (error) {
    logError('agent.updateProfile', error)
    return actionError(toUserMessage(error, ERROR_MESSAGES.saveFailed))
  }
}

export type AgentBankAccountResult = ActionResult<{
  accountName: string
  lastFour: string
  paystackReady: boolean
}>

export async function saveAgentBankAccountAction(
  _prev: AgentBankAccountResult | null,
  formData: FormData,
): Promise<AgentBankAccountResult> {
  const parsed = agentBankAccountSchema.safeParse(readForm(formData))
  if (!parsed.success) {
    return actionError('Please check the bank details.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const user = await requireAgentAction()
    const supabase = await createClient()
    const banks = await listNigerianBanks()
    const bank = banks.find((item) => item.code === parsed.data.bankCode)
    if (!bank) return actionError('Choose a valid Nigerian bank from the list.')

    const resolved = await resolveNigerianBankAccount(
      parsed.data.accountNumber,
      parsed.data.bankCode,
    )

    let recipientCode: string | null = null
    let recipientActive = false
    if (getPayoutMode() === 'paystack') {
      const recipient = await createPaystackTransferRecipient({
        name: resolved.account_name,
        accountNumber: resolved.account_number,
        bankCode: parsed.data.bankCode,
        description: `Concierge Go payout account for agent ${user.agent.id}`,
      })
      recipientCode = recipient.recipient_code
      recipientActive = recipient.active
    }

    const { error } = await supabase.from('agent_bank_accounts').upsert(
      {
        agent_id: user.agent.id,
        account_name: resolved.account_name,
        account_number: resolved.account_number,
        bank_code: parsed.data.bankCode,
        bank_name: bank.name,
        recipient_code: recipientCode,
        recipient_active: recipientActive,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id' },
    )
    if (error) throw error

    revalidatePath('/agent/profile')
    revalidatePath('/admin/payouts')
    return actionOk(
      {
        accountName: resolved.account_name,
        lastFour: resolved.account_number.slice(-4),
        paystackReady: Boolean(recipientCode && recipientActive),
      },
      getPayoutMode() === 'paystack'
        ? 'Bank account verified and connected for Paystack payouts.'
        : 'Bank account verified and saved for manual payouts.',
    )
  } catch (error) {
    logError('agent.saveBankAccount', error)
    return actionError(
      toUserMessage(
        error,
        'We could not verify that bank account. Check the number and bank, then try again.',
      ),
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Verification                                                               */
/* -------------------------------------------------------------------------- */

export type VerificationResult = ActionResult<{ verificationId: string }>

export async function submitVerificationAction(
  _prev: VerificationResult | null,
  formData: FormData,
): Promise<VerificationResult> {
  const raw = readForm(formData)
  const parsed = agentVerificationSchema.safeParse({
    ...raw,
    consentsToChecks: raw.consentsToChecks === 'on' || raw.consentsToChecks === 'true',
  })

  if (!parsed.success) {
    return actionError('Please check the details below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const user = await requireAgentAction()
    const supabase = await createClient()

    if (user.agent.verification_status === 'verified') {
      return actionError('You are already verified.')
    }

    if (user.agent.verification_status === 'suspended') {
      return actionError(
        'Your account is suspended. Contact Concierge Go operations before resubmitting.',
      )
    }

    const { data: pending } = await supabase
      .from('agent_verifications')
      .select('id')
      .eq('agent_id', user.agent.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) {
      return actionError('You already have a verification under review.')
    }

    const { data: verification, error } = await supabase
      .from('agent_verifications')
      .insert({
        agent_id: user.agent.id,
        status: 'pending',
        transport_mode: parsed.data.transportMode,
        availability: parsed.data.availability,
        experience: parsed.data.experience,
        motivation: parsed.data.motivation,
        referee_name: parsed.data.refereeName,
        referee_phone: parsed.data.refereePhone,
        consents_to_checks: parsed.data.consentsToChecks,
      })
      .select('id')
      .single()

    if (error) throw error

    await supabase
      .from('agents')
      .update({ transport_mode: parsed.data.transportMode })
      .eq('id', user.agent.id)

    revalidatePath('/agent/verification')
    revalidatePath('/agent')
    return actionOk(
      { verificationId: verification.id as string },
      'Verification submitted. Operations will review it shortly.',
    )
  } catch (error) {
    logError('agent.submitVerification', error)
    return actionError(toUserMessage(error, ERROR_MESSAGES.saveFailed))
  }
}

/** Signs one of this agent's proof files for viewing. */
export async function getProofUrlAction(proofId: string): Promise<ActionResult<{ url: string }>> {
  const parsed = uuidSchema.safeParse(proofId)
  if (!parsed.success) return actionError('That file is not valid.')

  try {
    await requireUserAction()
    const supabase = await createClient()

    const { data: proof } = await supabase
      .from('task_proofs')
      .select('bucket, storage_path')
      .eq('id', parsed.data)
      .maybeSingle()

    if (!proof?.storage_path) return actionError('That file could not be found.')

    const { data, error } = await supabase.storage
      .from(proof.bucket as string)
      .createSignedUrl(proof.storage_path as string, 600)

    if (error || !data?.signedUrl) return actionError('That file could not be opened.')

    return actionOk({ url: data.signedUrl })
  } catch (error) {
    logError('agent.getProofUrl', error)
    return actionError(toUserMessage(error))
  }
}
