import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/errors'
import { formatNaira } from '@/lib/format'
import type { NotificationType, TaskRow, UserRole } from '@/types/database'

import { sendEmail } from './email'
import { sendSms } from './sms'

/**
 * Notification service.
 *
 * One entry point (`notify`) writes the in-app record and fans out to whatever
 * external channels are configured. Email/SMS/WhatsApp providers are stubs
 * behind their own modules — when credentials appear they start delivering and
 * nothing else in the application changes.
 *
 * Notifications are deliberately best-effort: a failure here must never roll
 * back the business action that triggered it.
 */

export interface NotifyParams {
  profileId: string
  type: NotificationType
  title: string
  body: string
  taskId?: string | null
  link?: string | null
  /** Also attempt email/SMS where the provider is configured. */
  channels?: Array<'email' | 'sms'>
  email?: string | null
  phone?: string | null
}

export async function notify(params: NotifyParams): Promise<void> {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase.from('notifications').insert({
      profile_id: params.profileId,
      type: params.type,
      title: params.title,
      body: params.body,
      task_id: params.taskId ?? null,
      link: params.link ?? null,
    })
    if (error) throw error
  } catch (error) {
    logError('notifications.insert', error, { type: params.type, profileId: params.profileId })
  }

  const channels = params.channels ?? []

  if (channels.includes('email') && params.email) {
    void sendEmail({
      to: params.email,
      subject: params.title,
      body: params.body,
      link: params.link ?? null,
    }).catch((error) => logError('notifications.email', error))
  }

  if (channels.includes('sms') && params.phone) {
    void sendSms({
      to: params.phone,
      body: `${params.title} — ${params.body}`,
    }).catch((error) => logError('notifications.sms', error))
  }
}

export async function notifyMany(items: NotifyParams[]) {
  await Promise.allSettled(items.map((item) => notify(item)))
}

/** Notify every operations user. Used for events that need a human. */
export async function notifyAdmins(
  params: Omit<NotifyParams, 'profileId' | 'email' | 'phone'>,
): Promise<void> {
  const supabase = createAdminClient()

  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'admin')
      .eq('is_suspended', false)

    if (!admins?.length) return

    await notifyMany(
      admins.map((admin) => ({
        ...params,
        profileId: admin.id as string,
        email: admin.email as string,
      })),
    )
  } catch (error) {
    logError('notifications.notifyAdmins', error, { type: params.type })
  }
}

/* -------------------------------------------------------------------------- */
/* Event helpers — the vocabulary of the workflow, in one place.              */
/*                                                                            */
/* Every message answers the customer's four questions: what happened, what   */
/* happens next, how much, and who is handling it.                            */
/* -------------------------------------------------------------------------- */

type TaskLike = Pick<TaskRow, 'id' | 'reference' | 'title'>

const taskLink = (taskId: string) => `/tasks/${taskId}`

export const taskEvents = {
  async submitted(task: TaskLike, customerId: string, customerEmail?: string | null) {
    await notify({
      profileId: customerId,
      type: 'task_submitted',
      title: 'Your request has been received',
      body: `We have "${task.title}" (${task.reference}). Operations is reviewing it and will send you a quote.`,
      taskId: task.id,
      link: taskLink(task.id),
      channels: ['email'],
      email: customerEmail,
    })

    await notifyAdmins({
      type: 'task_submitted',
      title: 'New task request',
      body: `${task.reference} — ${task.title}. Needs review and a quote.`,
      taskId: task.id,
      link: `/admin/tasks/${task.id}`,
    })
  },

  async quoted(
    task: TaskLike,
    customerId: string,
    totalKobo: number,
    customerEmail?: string | null,
    customerPhone?: string | null,
  ) {
    await notify({
      profileId: customerId,
      type: 'quote_received',
      title: 'Your quote is ready',
      body: `${task.reference} — ${formatNaira(totalKobo)} total. Review the breakdown, then accept or decline.`,
      taskId: task.id,
      link: taskLink(task.id),
      channels: ['email', 'sms'],
      email: customerEmail,
      phone: customerPhone,
    })
  },

  async quoteAccepted(task: TaskLike, customerId: string, totalKobo: number) {
    await notify({
      profileId: customerId,
      type: 'quote_accepted',
      title: 'Quote accepted — payment is next',
      body: `Pay ${formatNaira(totalKobo)} to release ${task.reference} to a Go Agent.`,
      taskId: task.id,
      link: taskLink(task.id),
    })

    await notifyAdmins({
      type: 'quote_accepted',
      title: 'Quote accepted',
      body: `${task.reference} — awaiting payment of ${formatNaira(totalKobo)}.`,
      taskId: task.id,
      link: `/admin/tasks/${task.id}`,
    })
  },

  async quoteDeclined(task: TaskLike, reason: string | null) {
    await notifyAdmins({
      type: 'quote_declined',
      title: 'Quote declined',
      body: `${task.reference} — ${reason ?? 'No reason given.'} Consider a revised quote.`,
      taskId: task.id,
      link: `/admin/tasks/${task.id}`,
    })
  },

  async paymentReceived(
    task: TaskLike,
    customerId: string,
    amountKobo: number,
    customerEmail?: string | null,
  ) {
    await notify({
      profileId: customerId,
      type: 'payment_received',
      title: 'Payment received',
      body: `We have your ${formatNaira(amountKobo)} for ${task.reference}. We are assigning a Go Agent now.`,
      taskId: task.id,
      link: taskLink(task.id),
      channels: ['email'],
      email: customerEmail,
    })

    await notifyAdmins({
      type: 'payment_received',
      title: 'Task paid — needs an agent',
      body: `${task.reference} — ${formatNaira(amountKobo)} received. Assign a verified Go Agent.`,
      taskId: task.id,
      link: `/admin/tasks/${task.id}`,
    })
  },

  async agentAssigned(
    task: TaskLike,
    customerId: string,
    agentProfileId: string,
    agentName: string,
    customerPhone?: string | null,
  ) {
    await notify({
      profileId: customerId,
      type: 'agent_assigned',
      title: 'Your Go Agent has been assigned',
      body: `${agentName} is handling ${task.reference}. You can message them from the task page.`,
      taskId: task.id,
      link: taskLink(task.id),
      channels: ['sms'],
      phone: customerPhone,
    })

    await notify({
      profileId: agentProfileId,
      type: 'agent_assigned',
      title: 'New task assigned to you',
      body: `${task.reference} — ${task.title}. Open it to see the details and start.`,
      taskId: task.id,
      link: `/agent/tasks/${task.id}`,
    })
  },

  async statusAdvanced(
    task: TaskLike,
    customerId: string,
    headline: string,
    detail: string,
  ) {
    await notify({
      profileId: customerId,
      type: 'task_started',
      title: headline,
      body: `${task.reference} — ${detail}`,
      taskId: task.id,
      link: taskLink(task.id),
    })
  },

  async proofUploaded(task: TaskLike, customerId: string, customerEmail?: string | null) {
    await notify({
      profileId: customerId,
      type: 'proof_uploaded',
      title: 'Proof submitted — please review',
      body: `Your Go Agent finished ${task.reference} and submitted proof. Review it, then confirm completion or report a problem.`,
      taskId: task.id,
      link: taskLink(task.id),
      channels: ['email'],
      email: customerEmail,
    })
  },

  async completed(task: TaskLike, customerId: string, agentProfileId: string | null) {
    await notify({
      profileId: customerId,
      type: 'task_completed',
      title: 'Task completed',
      body: `${task.reference} is closed. The proof stays on the task page for your records.`,
      taskId: task.id,
      link: taskLink(task.id),
    })

    if (agentProfileId) {
      await notify({
        profileId: agentProfileId,
        type: 'task_completed',
        title: 'Customer confirmed completion',
        body: `${task.reference} is complete. Your payout has been recorded against your earnings.`,
        taskId: task.id,
        link: `/agent/tasks/${task.id}`,
      })
    }
  },

  async cancelled(task: TaskLike, recipients: Array<{ profileId: string; role: UserRole }>) {
    await notifyMany(
      recipients.map(({ profileId, role }) => ({
        profileId,
        type: 'task_cancelled' as const,
        title: 'Task cancelled',
        body: `${task.reference} — ${task.title} was cancelled.`,
        taskId: task.id,
        link: role === 'agent' ? `/agent/tasks/${task.id}` : taskLink(task.id),
      })),
    )
  },

  async disputeCreated(task: TaskLike, customerId: string) {
    await notify({
      profileId: customerId,
      type: 'dispute_created',
      title: 'We have your report',
      body: `Operations is reviewing the problem you reported on ${task.reference}. Someone will get back to you.`,
      taskId: task.id,
      link: taskLink(task.id),
    })

    await notifyAdmins({
      type: 'dispute_created',
      title: 'Dispute raised',
      body: `${task.reference} — a customer reported a problem. Needs review.`,
      taskId: task.id,
      link: `/admin/disputes`,
    })
  },

  async disputeResolved(task: TaskLike, customerId: string, outcome: string) {
    await notify({
      profileId: customerId,
      type: 'dispute_resolved',
      title: 'Your report has been resolved',
      body: `${task.reference} — ${outcome}`,
      taskId: task.id,
      link: taskLink(task.id),
    })
  },

  async messageReceived(
    task: TaskLike,
    recipientProfileId: string,
    senderName: string,
    preview: string,
    recipientRole: UserRole,
  ) {
    await notify({
      profileId: recipientProfileId,
      type: 'message_received',
      title: `New message from ${senderName}`,
      body: preview.length > 120 ? `${preview.slice(0, 119)}…` : preview,
      taskId: task.id,
      link: recipientRole === 'agent' ? `/agent/tasks/${task.id}` : taskLink(task.id),
    })
  },

  async verificationUpdated(agentProfileId: string, status: string, note: string) {
    await notify({
      profileId: agentProfileId,
      type: 'agent_verification_updated',
      title: `Verification ${status}`,
      body: note,
      link: '/agent/verification',
    })
  },
}
