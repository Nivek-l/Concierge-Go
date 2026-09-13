'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { adminUpdateTaskStatusAction, releaseAssignmentAction } from '@/actions/admin'
import { TASK_STATUS_META } from '@/lib/constants'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import type { TaskStatus } from '@/types/database'

const OVERRIDE_STATUSES: TaskStatus[] = [
  'under_review',
  'quoted',
  'awaiting_payment',
  'paid',
  'assigned',
  'in_progress',
  'awaiting_confirmation',
  'completed',
  'cancelled',
]

export function TaskStatusOverride({ taskId, currentStatus }: { taskId: string; currentStatus: TaskStatus }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<TaskStatus>(currentStatus)
  const [note, setNote] = useState('')
  const [isPending, setPending] = useState(false)

  async function handleSubmit() {
    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    formData.set('status', status)
    if (note.trim()) formData.set('note', note.trim())

    const result = await adminUpdateTaskStatusAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Status updated.')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setStatus(currentStatus) }}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change status
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Override task status</AlertDialogTitle>
          <AlertDialogDescription>
            Use this only when the normal workflow can&apos;t get the task where it needs to be.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERRIDE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TASK_STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={status === 'cancelled' ? 'Reason for cancellation' : 'Note (optional)'}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button loading={isPending} onClick={handleSubmit}>
            Update status
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ReleaseAssignmentButton({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, setPending] = useState(false)

  async function handleSubmit() {
    if (reason.trim().length < 5) {
      toast.error('Give a brief reason.')
      return
    }
    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    formData.set('reason', reason)

    const result = await releaseAssignmentAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Agent released.')
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
          Release agent
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release this agent?</AlertDialogTitle>
          <AlertDialogDescription>
            The task goes back to &quot;paid&quot; and can be reassigned. Tell us why.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" loading={isPending} onClick={handleSubmit}>
            Release agent
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
