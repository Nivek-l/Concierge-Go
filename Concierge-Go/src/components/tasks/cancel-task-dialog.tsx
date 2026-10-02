'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'

import { cancelTaskAction } from '@/actions/tasks'
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

export function CancelTaskDialog({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setPending] = useState(false)

  async function handleCancel() {
    if (reason.trim().length < 5) {
      toast.error('Tell us briefly why you are cancelling.')
      return
    }

    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    formData.set('reason', reason)

    const result = await cancelTaskAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Task cancelled.')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Ban className="h-4 w-4" aria-hidden />
          Cancel task
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this task?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Tell us briefly why you are cancelling.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. No longer needed"
          rows={3}
        />
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Keep task
          </Button>
          <Button variant="destructive" loading={isPending} onClick={handleCancel}>
            Cancel task
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
