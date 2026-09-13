'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'

import { completeMockPaymentAction } from '@/actions/payments'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'

export function MockPaymentActions({ reference }: { reference: string }) {
  const router = useRouter()
  const [pending, setPending] = useState<'success' | 'failure' | null>(null)

  async function handle(outcome: 'success' | 'failure') {
    setPending(outcome)
    const result = await completeMockPaymentAction(reference, outcome)
    setPending(null)

    if (result.ok) {
      if (outcome === 'success') {
        toast.success('Payment received.')
      } else {
        toast.error('Payment declined.')
      }
      router.push(`/tasks/${result.data.taskId}`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <Button
        size="lg"
        loading={pending === 'success'}
        disabled={pending !== null && pending !== 'success'}
        onClick={() => handle('success')}
      >
        <CheckCircle2 aria-hidden />
        Simulate successful payment
      </Button>
      <Button
        size="lg"
        variant="outline"
        loading={pending === 'failure'}
        disabled={pending !== null && pending !== 'failure'}
        onClick={() => handle('failure')}
      >
        <XCircle aria-hidden />
        Simulate failed payment
      </Button>
    </div>
  )
}
