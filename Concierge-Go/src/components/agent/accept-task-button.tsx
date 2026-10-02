'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { acceptTaskAction } from '@/actions/agent'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'

export function AcceptTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [isPending, setPending] = useState(false)

  async function handleAccept() {
    setPending(true)
    const result = await acceptTaskAction(taskId)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Task accepted.')
      router.push(`/agent/tasks/${taskId}`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Button size="sm" loading={isPending} onClick={handleAccept}>
      Accept task
    </Button>
  )
}
