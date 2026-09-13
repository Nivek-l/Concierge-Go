'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { advanceTaskAction } from '@/actions/agent'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'

export function AdvanceTaskButton({ taskId, label }: { taskId: string; label: string }) {
  const router = useRouter()
  const [isPending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    const result = await advanceTaskAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Updated.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Button size="lg" className="w-full" loading={isPending} onClick={handleClick}>
      {label}
      <ArrowRight aria-hidden />
    </Button>
  )
}
