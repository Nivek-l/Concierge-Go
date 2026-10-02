import type { Metadata } from 'next'
import Link from 'next/link'
import { Banknote, CircleCheck, Clock3, PauseCircle } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getPayoutLedger } from '@/database/payouts'
import { formatDateTime, formatNaira } from '@/lib/format'
import { payoutModeSummary } from '@/lib/env'
import { PAYOUT_STATUSES, type PayoutStatus } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PayoutActionForm } from '@/components/admin/payout-action-form'

export const metadata: Metadata = { title: 'Agent payouts', robots: { index: false, follow: false } }

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const status = PAYOUT_STATUSES.includes(params.status as PayoutStatus)
    ? (params.status as PayoutStatus)
    : 'all'
  const ledger = await getPayoutLedger({ status })
  const payoutMode = payoutModeSummary()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Agent payout ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings are recorded automatically when an assignment is completed.
        </p>
        </div>
        <Badge variant={payoutMode.automatic ? 'success' : 'neutral'}>{payoutMode.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={Clock3} label="Pending" value={ledger.pendingKobo} />
        <Summary icon={CircleCheck} label="Approved" value={ledger.approvedKobo} />
        <Summary icon={Banknote} label="Paid" value={ledger.paidKobo} />
        <Summary icon={PauseCircle} label="On hold" value={ledger.heldKobo} />
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter payouts">
        {['all', ...PAYOUT_STATUSES].map((item) => (
          <Link
            key={item}
            href={item === 'all' ? '/admin/payouts' : `/admin/payouts?status=${item}`}
            aria-current={status === item ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium ${
              status === item ? 'border-primary bg-primary-subtle text-primary' : 'bg-background hover:bg-muted'
            }`}
          >
            {item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
          </Link>
        ))}
      </nav>

      {ledger.entries.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No payout entries match this filter.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {ledger.entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/tasks/${entry.task_id}`} className="font-semibold hover:underline">
                        {entry.task_title}
                      </Link>
                      <Badge variant={toneForPayout(entry.status)}>{entry.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.task_reference} · {entry.agent_name} · Created {formatDateTime(entry.created_at)}
                    </p>
                    {entry.payment_reference ? (
                      <p className="mt-1 text-xs text-muted-foreground">Reference: {entry.payment_reference}</p>
                    ) : null}
                    {entry.bank_account ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.bank_account.bank_name} · {entry.bank_account.account_name} · {entry.bank_account.account_number}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-destructive">No payout bank account</p>
                    )}
                    {entry.provider_status ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paystack status: {entry.provider_status}
                        {entry.failure_reason ? ` · ${entry.failure_reason}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <dl className="grid min-w-48 gap-1 text-sm sm:text-right">
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="text-muted-foreground">Total service charge</dt>
                      <dd className="font-semibold">{formatNaira(entry.service_charge_kobo)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="text-muted-foreground">Go Agent (60%)</dt>
                      <dd className="font-semibold">{formatNaira(entry.amount_kobo)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="text-muted-foreground">Concierge Go (40%)</dt>
                      <dd className="font-semibold">{formatNaira(entry.concierge_share_kobo)}</dd>
                    </div>
                  </dl>
                </div>
                <PayoutActionForm
                  payoutId={entry.id}
                  currentStatus={entry.status}
                  payoutMode={payoutMode.mode}
                  providerStatus={entry.provider_status}
                  hasBankAccount={Boolean(entry.bank_account)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return <Card><CardContent className="pt-5"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden /><p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-bold sm:text-2xl">{formatNaira(value)}</p></CardContent></Card>
}

function toneForPayout(status: PayoutStatus): 'warning' | 'info' | 'success' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success'
  if (status === 'approved') return 'info'
  if (status === 'held') return 'danger'
  if (status === 'pending') return 'warning'
  return 'neutral'
}
