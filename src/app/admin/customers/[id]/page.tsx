import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Mail, MapPin, Phone } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getCustomerDetail } from '@/database/admin'
import { formatFriendlyDate, formatNaira, formatPhone, initials } from '@/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'
import { SuspendAccountButton } from '@/components/admin/suspend-account-button'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Customer ${id.slice(0, 8)}`, robots: { index: false, follow: false } }
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdmin()

  const detail = await getCustomerDetail(id)
  if (!detail) notFound()

  const { profile, cityName, tasks, addresses, totalSpentKobo } = detail

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
            <p className="text-sm text-muted-foreground">
              Joined {formatFriendlyDate(profile.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.is_suspended ? <Badge variant="danger">Suspended</Badge> : null}
          <SuspendAccountButton profileId={profile.id} isSuspended={profile.is_suspended} />
        </div>
      </div>

      {profile.is_suspended && profile.suspension_reason ? (
        <Card className="border-destructive/30 bg-destructive-subtle/40">
          <CardContent className="pt-5 text-sm text-muted-foreground text-pretty">
            {profile.suspension_reason}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <ul className="divide-y">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/admin/tasks/${task.id}`}
                        className="flex items-center justify-between gap-3 py-3 transition-colors hover:opacity-80"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{task.title}</p>
                            <UrgencyBadge urgency={task.urgency} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {task.reference} · {formatFriendlyDate(task.created_at)}
                          </p>
                        </div>
                        <TaskStatusBadge status={task.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {profile.email}
              </p>
              {profile.phone ? (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {formatPhone(profile.phone)}
                </a>
              ) : null}
              {cityName ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {cityName}
                  {profile.default_area ? `, ${profile.default_area}` : ''}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 border-t pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total spent</p>
                  <p className="font-medium">{formatNaira(totalSpentKobo)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="font-medium">{tasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {addresses.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Saved addresses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {addresses.map((address) => (
                  <div key={address.id as string} className="text-sm">
                    <p className="font-medium">{address.label as string}</p>
                    <p className="text-xs text-muted-foreground">{address.street_address as string}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
