import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  UserCheck,
  Users,
} from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getAdminStats, getOperationsQueue, getRecentActivity } from '@/database/admin'
import { getPayoutLedger } from '@/database/payouts'
import { formatFriendlyDate, formatNaira } from '@/lib/format'
import { TASK_STATUS_META } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Operations dashboard',
  robots: { index: false, follow: false },
}

export default async function AdminDashboardPage() {
  await requireAdmin()
  const [stats, queue, activity, payouts] = await Promise.all([
    getAdminStats(),
    getOperationsQueue(),
    getRecentActivity(10),
    getPayoutLedger({ limit: 100 }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Operations dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What needs your attention across Concierge Go right now.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Customers" value={String(stats?.total_customers ?? 0)} />
        <StatCard
          icon={UserCheck}
          label="Active agents"
          value={String(stats?.active_agents ?? 0)}
          sub={`${stats?.total_agents ?? 0} total`}
        />
        <StatCard
          icon={ClipboardList}
          label="Active tasks"
          value={String(stats?.tasks_active ?? 0)}
          sub={`${stats?.tasks_total ?? 0} total`}
        />
        <StatCard icon={CheckCircle2} label="Completed" value={String(stats?.tasks_completed ?? 0)} />
        <StatCard
          icon={Banknote}
          label="Gross revenue"
          value={formatNaira(stats?.gross_revenue_kobo ?? 0)}
        />
        <StatCard
          icon={CreditCard}
          label="Concierge Go share"
          value={formatNaira(Math.round((stats?.platform_fees_kobo ?? 0) * 0.4))}
        />
        <StatCard
          icon={Banknote}
          label="Pending payouts"
          value={formatNaira(payouts.pendingKobo + payouts.approvedKobo)}
          sub={`${formatNaira(payouts.paidKobo)} recorded paid`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Open disputes"
          value={String(stats?.open_disputes ?? 0)}
          tone={stats?.open_disputes ? 'warning' : undefined}
        />
      </div>

      <div className="flex justify-end">
        <Link href="/admin/payouts" className="text-sm font-medium text-primary hover:underline">
          Open payout ledger
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCard
          title="Needs review"
          count={stats?.tasks_awaiting_review ?? queue.needsReview.length}
          items={queue.needsReview}
          href="/admin/tasks?status=submitted"
        />
        <QueueCard
          title="Quotes awaiting response"
          count={stats?.quotes_awaiting_response ?? 0}
          items={queue.awaitingQuoteResponse}
          href="/admin/tasks?status=quoted"
        />
        <QueueCard
          title="Needs assignment"
          count={stats?.tasks_awaiting_assignment ?? queue.needsAssignment.length}
          items={queue.needsAssignment}
          href="/admin/tasks?status=paid"
        />
        <QueueCard
          title="Open disputes"
          count={stats?.open_disputes ?? queue.openDisputes.length}
          items={queue.openDisputes}
          href="/admin/disputes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/tasks/${entry.task_id}`} className="font-medium hover:underline">
                      {entry.task_title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {entry.task_reference} → {TASK_STATUS_META[entry.to_status].label}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatFriendlyDate(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  tone?: 'warning'
}) {
  return (
    <Card className={tone === 'warning' ? 'border-warning/30 bg-warning-subtle/30' : undefined}>
      <CardContent className="pt-5 sm:pt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </div>
        <p className="mt-1.5 font-display text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}

function QueueCard({
  title,
  count,
  items,
  href,
}: {
  title: string
  count: number
  items: Array<{ id: string; title: string; reference: string; status: string }>
  href: string
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Badge variant={count > 0 ? 'warning' : 'neutral'}>{count}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing here.</p>
        ) : (
          items.slice(0, 4).map((item) => (
            <Link
              key={item.id}
              href={`/admin/tasks/${item.id}`}
              className="block truncate rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
            >
              {item.title}
            </Link>
          ))
        )}
        <Link href={href} className="block pt-1 text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </CardContent>
    </Card>
  )
}
