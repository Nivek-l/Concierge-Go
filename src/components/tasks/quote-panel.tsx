'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { respondToQuoteAction } from '@/actions/tasks'
import { formatDateTime, formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import type { TaskQuoteRow } from '@/types/database'

export function QuotePanel({ taskId, quote }: { taskId: string; quote: TaskQuoteRow }) {
  const router = useRouter()
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setPending] = useState(false)

  async function respond(decision: 'accept' | 'decline') {
    if (decision === 'decline' && reason.trim().length < 5) {
      toast.error('Tell us briefly why, so we can revise the quote.')
      return
    }

    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    formData.set('quoteId', quote.id)
    formData.set('decision', decision)
    if (decision === 'decline') formData.set('reason', reason)

    const result = await respondToQuoteAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Done.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const lines: Array<[string, number]> = [
    ['Service fee', quote.service_fee_kobo],
    ['Transportation', quote.transport_fee_kobo],
  ]
  if (quote.additional_fee_kobo > 0) {
    lines.push([quote.additional_fee_note ?? 'Additional charges', quote.additional_fee_kobo])
  }
  lines.push(['Platform fee', quote.platform_fee_kobo])

  return (
    <Card className="border-warning/30 bg-warning-subtle/40">
      <CardHeader>
        <CardTitle>Your quote</CardTitle>
        <p className="text-xs text-muted-foreground">
          Valid until {formatDateTime(quote.expires_at)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 rounded-lg border bg-card p-4">
          {lines.map(([label, kobo]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{formatNaira(kobo)}</dd>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatNaira(quote.total_kobo)}</dd>
          </div>
        </dl>

        {quote.notes ? (
          <p className="rounded-lg bg-card p-3 text-sm text-muted-foreground text-pretty">
            {quote.notes}
          </p>
        ) : null}

        {declining ? (
          <div className="space-y-2.5">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Tell us why you're declining — too expensive, wrong scope, etc."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeclining(false)}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={isPending}
                onClick={() => respond('decline')}
              >
                Send decline reason
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" loading={isPending} onClick={() => respond('accept')}>
              Accept quote
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={() => setDeclining(true)}
            >
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
