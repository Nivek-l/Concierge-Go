import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Calendar, MapPin, MessageSquare, Phone, User } from 'lucide-react'

import { requireAgent } from '@/lib/auth'
import {
  getMessageSenders,
  getTaskDetail,
  getTaskFileUrls,
  getTaskParticipants,
} from '@/database/tasks'
import { AGENT_ACTION_LABEL } from '@/lib/constants'
import { formatFriendlyDate, formatNaira, formatPhone } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusExplainer, TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'
import { AttachmentList, ProofList } from '@/components/tasks/attachment-list'
import { MessageThread } from '@/components/tasks/message-thread'
import { TaskTimeline } from '@/components/tasks/task-timeline'
import { AdvanceTaskButton } from '@/components/agent/advance-task-button'
import { ProofForm } from '@/components/agent/proof-form'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Task ${id.slice(0, 8)}`, robots: { index: false, follow: false } }
}

export default async function AgentTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAgent()

  const detail = await getTaskDetail(id)
  if (!detail || !detail.assignment || detail.assignment.agent_id !== user.agent.id) notFound()

  const { task, category } = detail
  const isActiveAssignment = detail.assignment.status === 'active'
  const nextActionLabel = AGENT_ACTION_LABEL[task.status]

  const [fileUrls, senders, participants] = await Promise.all([
    getTaskFileUrls(detail),
    getMessageSenders(detail.messages),
    getTaskParticipants(id),
  ])

  const customer = participants.customer

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              {task.title}
            </h1>
            <UrgencyBadge urgency={task.urgency} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.reference} · {category.name}
          </p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <StatusExplainer status={task.status} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {isActiveAssignment && nextActionLabel ? (
            <Card className="border-primary/30 bg-primary-subtle/40">
              <CardContent className="pt-5">
                <AdvanceTaskButton taskId={id} label={nextActionLabel} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Task details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-pretty">{task.description}</p>
              {task.additional_instructions ? (
                <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground text-pretty">
                  {task.additional_instructions}
                </p>
              ) : null}

              <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">
                      {task.location_address}
                      {task.location_area ? `, ${task.location_area}` : ''}
                    </dd>
                  </div>
                </div>
                {task.destination_required ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <dt className="text-muted-foreground">Destination</dt>
                      <dd className="font-medium">
                        {task.destination_address}
                        {task.destination_area ? `, ${task.destination_area}` : ''}
                      </dd>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">Preferred timing</dt>
                    <dd className="font-medium">
                      {task.preferred_date ? formatFriendlyDate(task.preferred_date) : 'Flexible'}
                      {task.preferred_time_slot ? ` · ${task.preferred_time_slot}` : ''}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-muted-foreground">₦</span>
                  <div>
                    <dt className="text-muted-foreground">Your payout</dt>
                    <dd className="font-medium">{formatNaira(detail.assignment.agent_payout_kobo)}</dd>
                  </div>
                </div>
              </dl>

              <AttachmentList title="Attachments" items={detail.attachments} fileUrls={fileUrls} />
            </CardContent>
          </Card>

          {task.requires_proof ? (
            <Card>
              <CardHeader>
                <CardTitle>Proof</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <ProofList proofs={detail.proofs} fileUrls={fileUrls} />
                {isActiveAssignment ? (
                  <div className="border-t pt-4">
                    <ProofForm taskId={id} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {customer ? (
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {customer.full_name}
                </p>
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {formatPhone(customer.phone)}
                  </a>
                ) : null}
                {customer.area ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {customer.area}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskTimeline status={task.status} history={detail.history} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageThread
                taskId={id}
                messages={detail.messages.filter((message) => !message.is_internal)}
                senders={senders}
                currentUserId={user.id}
                canSend={isActiveAssignment}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
