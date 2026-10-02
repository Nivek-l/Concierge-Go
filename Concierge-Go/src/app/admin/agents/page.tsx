import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, UserCheck } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getAgentDirectory } from '@/database/agents'
import { formatFriendlyDate, initials } from '@/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import type { VerificationStatus } from '@/types/database'

export const metadata: Metadata = {
  title: 'Manage agents',
  robots: { index: false, follow: false },
}

const STATUS_TONE: Record<VerificationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

const FILTERS: Array<{ value: VerificationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const status = (params.status ?? 'all') as VerificationStatus | 'all'
  const search = params.q ?? ''

  const agents = await getAgentDirectory({ status, search })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Manage agents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {agents.length} agent{agents.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link key={filter.value} href={`/admin/agents?status=${filter.value}${search ? `&q=${search}` : ''}`}>
            <Badge variant={status === filter.value ? 'progress' : 'neutral'} className="cursor-pointer px-3 py-1.5">
              {filter.label}
            </Badge>
          </Link>
        ))}
      </div>

      <form className="flex gap-2" action="/admin/agents">
        <input type="hidden" name="status" value={status} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Search name, email or phone" className="pl-9" />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {agents.length === 0 ? (
        <EmptyState icon={UserCheck} title="No agents found" description="Try a different filter or search term." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((item) => (
            <Link key={item.agent.id} href={`/admin/agents/${item.agent.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={item.profile.avatar_url ?? undefined} alt="" />
                        <AvatarFallback className="text-xs">{initials(item.profile.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.profile.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.profile.email}</p>
                      </div>
                    </div>
                    <Badge variant={STATUS_TONE[item.agent.verification_status]}>
                      {item.agent.verification_status}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <dt>Rating</dt>
                      <dd className="font-medium text-foreground">
                        {item.agent.rating.toFixed(1)} ({item.agent.rating_count})
                      </dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd className="font-medium text-foreground">{item.agent.completed_tasks}</dd>
                    </div>
                    <div>
                      <dt>Active now</dt>
                      <dd className="font-medium text-foreground">{item.activeTaskCount}</dd>
                    </div>
                    <div>
                      <dt>Joined</dt>
                      <dd className="font-medium text-foreground">
                        {formatFriendlyDate(item.profile.created_at)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
