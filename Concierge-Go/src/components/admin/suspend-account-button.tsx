'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { suspendAccountAction } from '@/actions/admin'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'

export function SuspendAccountButton({
  profileId,
  isSuspended,
}: {
  profileId: string
  isSuspended: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setPending] = useState(false)

  async function handleSubmit() {
    setPending(true)
    const formData = new FormData()
    formData.set('profileId', profileId)
    formData.set('suspended', isSuspended ? '' : 'on')
    if (reason.trim()) formData.set('reason', reason.trim())

    const result = await suspendAccountAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Updated.')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={isSuspended ? 'outline' : 'destructive'}>
          {isSuspended ? 'Restore account' : 'Suspend account'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSuspended ? 'Restore this account?' : 'Suspend this account?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSuspended
              ? 'They will be able to sign in and use Concierge Go again.'
              : 'They will be signed out of Concierge Go until restored.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isSuspended ? (
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for suspension"
            rows={3}
          />
        ) : null}
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isSuspended ? 'default' : 'destructive'}
            loading={isPending}
            onClick={handleSubmit}
          >
            {isSuspended ? 'Restore' : 'Suspend'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
