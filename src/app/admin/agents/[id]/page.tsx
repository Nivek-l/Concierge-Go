import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Star } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getAgentDetail } from '@/database/agents'
import { formatDateTime, formatFriendlyDate, formatNaira, formatPhone, initials } from '@/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskStatusBadge } from '@/components/shared/status-badge'
import { VerificationReviewActions } from '@/components/admin/verification-review-actions'
import { SuspendAccountButton } from '@/components/admin/suspend-account-button'
import type { VerificationStatus } from '@/types/database'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Agent ${id.slice(0, 8)}`, robots: { index: false, follow: false } }
}

const STATUS_TONE: Record<VerificationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

export default async function AdminAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdmin()

  const detail = await getAgentDetail(id)
  if (!detail || !detail.profile) notFound()

  const { agent, profile, serviceAreas, verifications, assignments, reviews } = detail
  const latestVerification = verifications[0] ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              {profile.full_name}
            </h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_TONE[agent.verification_status]}>{agent.verification_status}</Badge>
          <SuspendAccountButton profileId={profile.id} isSuspended={agent.verification_status === 'suspended'} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VerificationReviewActions
                agentId={agent.id}
                verificationId={latestVerification?.id ?? null}
                currentStatus={agent.verification_status}
              />

              {latestVerification ? (
                <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                  <Info label="Transport" value={latestVerification.transport_mode} />
                  <Info label="Availability" value={latestVerification.availability} />
                  {latestVerification.experience ? (
                    <Info label="Experience" value={latestVerification.experience} span />
                  ) : null}
                  {latestVerification.motivation ? (
                    <Info label="Motivation" value={latestVerification.motivation} span />
                  ) : null}
                  {latestVerification.referee_name ? (
                    <Info
                      label="Referee"
                      value={`${latestVerification.referee_name}${latestVerification.referee_phone ? ` · ${formatPhone(latestVerification.referee_phone)}` : ''}`}
                    />
                  ) : null}
                  <Info label="Submitted" value={formatDateTime(latestVerification.submitted_at)} />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No verification submitted yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task history</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
              ) : (
                <ul className="divide-y">
                  {assignments.map((assignment) => (
                    <li key={assignment.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/tasks/${assignment.task_id}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {assignment.task?.title ?? 'Task'}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {assignment.task?.reference} · {formatFriendlyDate(assignment.assigned_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {assignment.task ? <TaskStatusBadge status={assignment.task.status} /> : null}
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatNaira(assignment.agent_payout_kobo)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {reviews.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Customer reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-warning text-warning' : 'text-muted-foreground'}`}
                        />
                      ))}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {formatFriendlyDate(review.created_at)}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{review.comment}</p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {profile.phone ? (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {formatPhone(profile.phone)}
                </a>
              ) : null}
              <p className="flex items-center gap-1 text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
                {agent.rating.toFixed(1)} rating ({agent.rating_count} reviews)
              </p>
              <p className="text-muted-foreground">{agent.completed_tasks} tasks completed</p>
              <p className="text-muted-foreground">{agent.transport_mode ?? 'Transport not set'}</p>
              <p className="text-muted-foreground">Joined {formatFriendlyDate(profile.created_at)}</p>
            </CardContent>
          </Card>

          {serviceAreas.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Service areas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {serviceAreas.map((area) => (
                  <p key={area.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {area.area_name}
                    {area.city_name ? `, ${area.city_name}` : ''}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : undefined}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-pretty">{value}</dd>
    </div>
  )
}
