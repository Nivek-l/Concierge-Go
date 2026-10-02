import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getPaymentMode } from '@/lib/env'
import { formatNaira } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/shared/logo'
import { MockPaymentActions } from '@/components/tasks/mock-payment-actions'

export const metadata: Metadata = {
  title: 'Development payment',
  robots: { index: false, follow: false },
}

export default async function MockPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; task?: string }>
}) {
  const { reference, task: taskId } = await searchParams
  const user = await requireCustomer()

  if (getPaymentMode() !== 'mock') {
    redirect(reference ? `/payments/callback?reference=${encodeURIComponent(reference)}` : '/dashboard')
  }

  if (!reference || !taskId) redirect('/dashboard')

  const supabase = await createClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('amount_kobo, status, task_id')
    .eq('reference', reference)
    .maybeSingle()

  if (!payment || payment.task_id !== taskId) redirect('/dashboard')

  const { data: task } = await supabase
    .from('tasks')
    .select('title, reference')
    .eq('id', taskId)
    .maybeSingle()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-soft">
        <Logo href={null} showWordmark={false} size="sm" />
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Development payment mode — no money moves and no card is charged.
        </div>

        <h1 className="mt-5 text-lg font-semibold">Confirm your payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {task?.title} · {task?.reference}
        </p>
        <p className="mt-4 font-display text-3xl font-bold tracking-tight">
          {formatNaira(payment.amount_kobo as number)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Paying as {user.email}</p>

        <MockPaymentActions reference={reference} />
      </div>
    </main>
  )
}
