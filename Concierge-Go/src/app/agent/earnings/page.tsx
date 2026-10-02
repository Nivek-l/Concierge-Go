import type { Metadata } from 'next'
import Link from 'next/link'
import { Banknote, CircleCheck, Clock3, PauseCircle } from 'lucide-react'

import { requireAgent } from '@/lib/auth'
import { getPayoutLedger } from '@/database/payouts'
import { formatDateTime, formatNaira } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'My earnings', robots: { index: false, follow: false } }

export default async function AgentEarningsPage() {
  const user = await requireAgent()
  const ledger = await getPayoutLedger({ agentId: user.agent.id })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">My earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">A clear record of completed-task payouts and their status.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={Clock3} label="Pending review" value={ledger.pendingKobo} />
        <Summary icon={CircleCheck} label="Approved" value={ledger.approvedKobo} />
        <Summary icon={Banknote} label="Paid" value={ledger.paidKobo} />
        <Summary icon={PauseCircle} label="On hold" value={ledger.heldKobo} />
      </div>
      <Card>
        <CardHeader><CardTitle>Payout history</CardTitle></CardHeader>
        <CardContent>
          {ledger.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Completed task earnings will appear here.</p>
          ) : (
            <ul className="divide-y">
              {ledger.entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/agent/tasks/${entry.task_id}`} className="font-medium hover:underline">{entry.task_title}</Link>
                    <p className="text-xs text-muted-foreground">{entry.task_reference} · {formatDateTime(entry.created_at)}</p>
                    {entry.payment_reference ? <p className="text-xs text-muted-foreground">Transfer reference: {entry.payment_reference}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <p className="font-semibold">{formatNaira(entry.amount_kobo)}</p>
                    <Badge variant={entry.status === 'paid' ? 'success' : entry.status === 'approved' ? 'info' : entry.status === 'held' ? 'danger' : 'warning'}>{entry.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return <Card><CardContent className="pt-5"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden /><p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-bold sm:text-2xl">{formatNaira(value)}</p></CardContent></Card>
}
