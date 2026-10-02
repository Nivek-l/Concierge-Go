import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getDisputes } from '@/database/admin'
import { DISPUTE_REASON_META } from '@/lib/constants'
import { formatFriendlyDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DisputeStatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { DisputeResolutionForm } from '@/components/admin/dispute-resolution-form'
import type { DisputeStatus } from '@/types/database'

export const metadata: Metadata = {
  title: 'Disputes',
  robots: { index: false, follow: false },
}

const FILTERS: Array<{ value: DisputeStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const { status: statusParam } = await searchParams
  const status = (statusParam ?? 'open') as DisputeStatus | 'all'
  const disputes = await getDisputes(status)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Disputes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {disputes.length} report{disputes.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link key={filter.value} href={`/admin/disputes?status=${filter.value}`}>
            <Badge variant={status === filter.value ? 'progress' : 'neutral'} className="cursor-pointer px-3 py-1.5">
              {filter.label}
            </Badge>
          </Link>
        ))}
      </div>

      {disputes.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No reports here" description="Nothing needs attention with this filter." />
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <Card key={dispute.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {dispute.task ? (
                        <Link href={`/admin/tasks/${dispute.task.id}`} className="hover:underline">
                          {dispute.task.title}
                        </Link>
                      ) : (
                        'Task'
                      )}
                    </CardTitle>
                    <DisputeStatusBadge status={dispute.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dispute.task?.reference} · Raised by {dispute.raised_by_name} ·{' '}
                    {formatFriendlyDate(dispute.created_at)}
                  </p>
                </div>
                <Badge variant="neutral">{DISPUTE_REASON_META[dispute.reason].label}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-pretty">{dispute.description}</p>
                {dispute.resolution_note ? (
                  <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground text-pretty">
                    <strong>Resolution:</strong> {dispute.resolution_note}
                  </p>
                ) : null}
                {dispute.status === 'open' || dispute.status === 'under_review' ? (
                  <DisputeResolutionForm disputeId={dispute.id} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
