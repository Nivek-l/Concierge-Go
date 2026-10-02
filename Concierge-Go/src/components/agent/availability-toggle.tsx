'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { setAvailabilityAction } from '@/actions/agent'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/sonner'

export function AvailabilityToggle({ initialValue }: { initialValue: boolean }) {
  const router = useRouter()
  const [isAvailable, setIsAvailable] = useState(initialValue)
  const [isPending, startTransition] = useTransition()

  function toggle(next: boolean) {
    setIsAvailable(next)
    startTransition(async () => {
      const result = await setAvailabilityAction(next)
      if (result.ok) {
        toast.success(result.message ?? 'Updated.')
        router.refresh()
      } else {
        setIsAvailable(!next)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-2.5">
      <Switch checked={isAvailable} onCheckedChange={toggle} disabled={isPending} />
      <span className="text-sm font-medium">
        {isAvailable ? 'Available for tasks' : 'Not accepting tasks'}
      </span>
    </div>
  )
}
