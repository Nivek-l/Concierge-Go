import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Calendar, MapPin, MessageSquare, Phone, Wallet } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getAssignmentCandidates } from '@/database/agents'
import {
  getMessageSenders,
  getTaskDetail,
  getTaskFileUrls,
  getTaskParticipants,
} from '@/database/tasks'
import { formatFriendlyDate, formatNaira, formatPhone } from '@/lib/format'
import { suggestQuote } from '@/services/pricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DisputeStatusBadge, StatusExplainer, TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'
import { AttachmentList, ProofList } from '@/components/tasks/attachment-list'
import { MessageThread } from '@/components/tasks/message-thread'
import { TaskTimeline } from '@/components/tasks/task-timeline'
import { QuoteForm } from '@/components/admin/quote-form'
import { AssignAgentPanel } from '@/components/admin/assign-agent-panel'
import { ReleaseAssignmentButton, TaskStatusOverride } from '@/components/admin/task-status-controls'

const QUOTABLE = ['submitted', 'under_review', 'quoted']
const ASSIGNABLE = ['paid', 'assigned']

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Task ${id.slice(0, 8)}`, robots: { index: false, follow: false } }
}

export default async function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = await requireAdmin()

  const detail = await getTaskDetail(id)
  if (!detail) notFound()

  const { task, category, city, activeQuote, acceptedQuote, latestPayment, dispute } = detail

  const [fileUrls, senders, participants, candidates] = await Promise.all([
    getTaskFileUrls(detail),
    getMessageSenders(detail.messages),
    getTaskParticipants(id),
    ASSIGNABLE.includes(task.status)
      ? getAssignmentCandidates({ city_id: task.city_id, location_area: task.location_area })
      : Promise.resolve([]),
  ])

  const suggested = suggestQuote({
    baseServiceFeeKobo: category.typical_service_fee_kobo,
    urgency: task.urgency,
    complexity: task.interpretation?.complexity,
    destinationRequired: task.destination_required,
    budgetKobo: task.budget_kobo,
  })

  const customer = participants.customer
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
          <TaskStatusOverride taskId={id} currentStatus={task.status} />
          {detail.assignment?.status === 'active' ? <ReleaseAssignmentButton taskId={id} /> : null}
        </div>
      </div>

      <StatusExplainer status={task.status} />

      {dispute ? (
        <Card className="border-destructive/30 bg-destructive-subtle/40">
          <CardContent className="flex items-start justify-between gap-3 pt-5">
            <div className="flex items-start gap-3">
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
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/disputes">Resolve</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {QUOTABLE.includes(task.status) ? (
            <Card>
              <CardHeader>
                <CardTitle>{activeQuote ? 'Revise quote' : 'Send a quote'}</CardTitle>
              </CardHeader>
              <CardContent>
                <QuoteForm
                  taskId={id}
                  suggested={{
                    serviceFeeNaira: suggested.serviceFeeKobo / 100,
                    transportFeeNaira: suggested.transportFeeKobo / 100,
                    platformFeeNaira: suggested.platformFeeKobo / 100,
                    agentPayoutNaira: suggested.agentPayoutKobo / 100,
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          {ASSIGNABLE.includes(task.status) ? (
            <Card>
              <CardHeader>
                <CardTitle>{task.status === 'assigned' ? 'Reassign agent' : 'Assign a Go Agent'}</CardTitle>
              </CardHeader>
              <CardContent>
                <AssignAgentPanel
                  taskId={id}
                  candidates={candidates}
                  currentAgentId={detail.assignment?.agent_id}
                  agentPayoutKobo={detail.assignment?.agent_payout_kobo ?? acceptedQuote?.agent_payout_kobo}
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
                      <dt className="text-muted-foreground">Customer&apos;s budget</dt>
                      <dd className="font-medium">{formatNaira(task.budget_kobo)}</dd>
                    </div>
                  </div>
                ) : null}
              </dl>

              {task.interpretation ? (
                <div className="flex flex-wrap gap-1.5 border-t pt-4">
                  <Badge variant="info">AI read: {task.interpretation.task_summary}</Badge>
                  <Badge variant="neutral">{task.interpretation.complexity} complexity</Badge>
                  {task.interpretation.requires_proof ? (
                    <Badge variant="neutral">Proof recommended</Badge>
                  ) : null}
                </div>
              ) : null}

              <AttachmentList title="Attachments" items={detail.attachments} fileUrls={fileUrls} />
            </CardContent>
          </Card>

          {detail.proofs.length > 0 || task.requires_proof ? (
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
              <CardContent className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatNaira(latestPayment.amount_kobo)} · {latestPayment.provider} ·{' '}
                  {latestPayment.reference}
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
                  {latestPayment.status}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer ? (
                <>
                  <Link href={`/admin/customers/${task.customer_id}`} className="text-sm font-medium hover:underline">
                    {customer.full_name}
                  </Link>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {formatPhone(customer.phone)}
                    </a>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Member since {formatFriendlyDate(customer.member_since)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Customer details unavailable.</p>
              )}
            </CardContent>
          </Card>

          {agent ? (
            <Card>
              <CardHeader>
                <CardTitle>Go Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/admin/agents/${agent.id}`} className="text-sm font-medium hover:underline">
                  {agent.full_name}
                </Link>
                {agent.phone ? (
                  <a href={`tel:${agent.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {formatPhone(agent.phone)}
                  </a>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {agent.rating.toFixed(1)} rating · {agent.completed_tasks} completed
                </p>
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
                messages={detail.messages}
                senders={senders}
                currentUserId={admin.id}
                canSend
                allowInternal
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
