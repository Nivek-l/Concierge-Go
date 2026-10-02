import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Calendar, MapPin, MessageSquare, Phone, Star, Wallet } from 'lucide-react'

import { requireUser } from '@/lib/auth'
import {
  getMessageSenders,
  getTaskDetail,
  getTaskFileUrls,
  getTaskLiveLocation,
  getTaskParticipants,
} from '@/database/tasks'
import { formatFriendlyDate, formatNaira, formatPhone, initials } from '@/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DisputeStatusBadge, StatusExplainer, TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'
import { AttachmentList, ProofList } from '@/components/tasks/attachment-list'
import { CancelTaskDialog } from '@/components/tasks/cancel-task-dialog'
import { MessageThread } from '@/components/tasks/message-thread'
import { PaymentPanel } from '@/components/tasks/payment-panel'
import { ProofReviewPanel } from '@/components/tasks/proof-review-panel'
import { QuotePanel } from '@/components/tasks/quote-panel'
import { TaskTimeline } from '@/components/tasks/task-timeline'
import { TaskLiveMap } from '@/components/tasks/task-live-map'

const CANCELLABLE = ['draft', 'submitted', 'under_review', 'quoted', 'awaiting_payment']

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Task ${id.slice(0, 8)}`, robots: { index: false, follow: false } }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  if (user.role === 'agent') redirect(`/agent/tasks/${id}`)
  if (user.role === 'admin') redirect(`/admin/tasks/${id}`)

  const detail = await getTaskDetail(id)
  if (!detail || detail.task.customer_id !== user.id) notFound()

  const { task, category, city, activeQuote, acceptedQuote, latestPayment, dispute } = detail

  const [fileUrls, senders, participants, liveLocation] = await Promise.all([
    getTaskFileUrls(detail),
    getMessageSenders(detail.messages),
    getTaskParticipants(id),
    getTaskLiveLocation(id),
  ])

  const agent = participants.agent

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
            {task.reference} · {category.name} · Requested {formatFriendlyDate(task.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          {CANCELLABLE.includes(task.status) ? <CancelTaskDialog taskId={id} /> : null}
        </div>
      </div>

      <StatusExplainer status={task.status} />

      {dispute ? (
        <Card className="border-destructive/30 bg-destructive-subtle/40">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">A report is open on this task</p>
                <DisputeStatusBadge status={dispute.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {dispute.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {task.status === 'quoted' && activeQuote ? (
            <QuotePanel taskId={id} quote={activeQuote} />
          ) : null}

          {task.status === 'awaiting_payment' && acceptedQuote ? (
            <PaymentPanel taskId={id} amountKobo={acceptedQuote.total_kobo} />
          ) : null}

          {task.status === 'awaiting_confirmation' ? <ProofReviewPanel taskId={id} /> : null}

          {['assigned', 'en_route', 'arrived', 'in_progress', 'awaiting_confirmation'].includes(task.status) ? (
            <Card>
              <CardHeader><CardTitle>Track your Go Agent</CardTitle></CardHeader>
              <CardContent>
                <TaskLiveMap
                  taskId={id}
                  status={task.status}
                  initialLocation={liveLocation}
                  pickup={task.location_latitude != null && task.location_longitude != null ? { latitude: task.location_latitude, longitude: task.location_longitude } : null}
                  destination={task.destination_latitude != null && task.destination_longitude != null ? { latitude: task.destination_latitude, longitude: task.destination_longitude } : null}
                />
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
                      {city ? `, ${city.name}` : ''}
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
                {task.budget_kobo ? (
                  <div className="flex items-start gap-2">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <dt className="text-muted-foreground">Your budget</dt>
                      <dd className="font-medium">{formatNaira(task.budget_kobo)}</dd>
                    </div>
                  </div>
                ) : null}
                {task.contact_phone ? (
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <dt className="text-muted-foreground">Contact for this task</dt>
                      <dd className="font-medium">{formatPhone(task.contact_phone)}</dd>
                    </div>
                  </div>
                ) : null}
              </dl>

              <AttachmentList title="Attachments" items={detail.attachments} fileUrls={fileUrls} />
            </CardContent>
          </Card>

          {task.requires_proof || detail.proofs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Proof of completion</CardTitle>
              </CardHeader>
              <CardContent>
                <ProofList proofs={detail.proofs} fileUrls={fileUrls} />
              </CardContent>
            </Card>
          ) : null}

          {latestPayment ? (
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words text-muted-foreground">
                  {formatNaira(latestPayment.amount_kobo)} · {latestPayment.provider}
                </span>
                <Badge
                  variant={
                    latestPayment.status === 'succeeded'
                      ? 'success'
                      : latestPayment.status === 'failed'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {latestPayment.status === 'succeeded' ? 'Paid' : latestPayment.status}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {agent ? (
            <Card>
              <CardHeader>
                <CardTitle>Your Go Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={agent.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials(agent.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{agent.full_name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-warning text-warning" aria-hidden />
                      {agent.rating.toFixed(1)} ({agent.rating_count}) ·{' '}
                      {agent.completed_tasks} completed
                    </p>
                  </div>
                </div>
                {agent.phone ? (
                  <a
                    href={`tel:${agent.phone}`}
                    className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {formatPhone(agent.phone)}
                  </a>
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
                canSend={!['completed', 'cancelled'].includes(task.status)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Need help with something else?{' '}
        <Link href="/tasks/new" className="font-medium text-primary hover:underline">
          Request another task
        </Link>
      </p>
    </div>
  )
}
