'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { reviewVerificationAction } from '@/actions/admin'
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
import type { VerificationStatus } from '@/types/database'

export function VerificationReviewActions({
  agentId,
  verificationId,
  currentStatus,
}: {
  agentId: string
  verificationId: string | null
  currentStatus: VerificationStatus
}) {
  const router = useRouter()

  async function review(status: VerificationStatus, notes?: string) {
    const formData = new FormData()
    formData.set('agentId', agentId)
    if (verificationId) formData.set('verificationId', verificationId)
    formData.set('status', status)
    if (notes) formData.set('notes', notes)

    const result = await reviewVerificationAction(formData)
    if (result.ok) {
      toast.success(result.message ?? 'Updated.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
    return result.ok
  }

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus !== 'verified' ? (
        <ConfirmButton
          label="Verify agent"
          title="Verify this agent?"
          description="They will be able to accept tasks from the job board immediately."
          onConfirm={() => review('verified')}
        />
      ) : null}
      {currentStatus !== 'rejected' ? (
        <ConfirmWithNote
          label="Reject"
          title="Reject this verification"
          description="Tell the agent what needs to change so they can resubmit."
          variant="outline"
          onConfirm={(notes) => review('rejected', notes)}
        />
      ) : null}
      {currentStatus !== 'suspended' ? (
        <ConfirmWithNote
          label="Suspend"
          title="Suspend this agent"
          description="They will stop appearing on the job board and lose any active assignments will need manual reassignment."
          variant="destructive"
          onConfirm={(notes) => review('suspended', notes)}
        />
      ) : (
        <ConfirmButton
          label="Reinstate"
          title="Reinstate this agent?"
          description="They will be marked verified and can accept tasks again."
          onConfirm={() => review('verified')}
        />
      )}
    </div>
  )
}

function ConfirmButton({
  label,
  title,
  description,
  onConfirm,
}: {
  label: string
  title: string
  description: string
  onConfirm: () => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [isPending, setPending] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm">{label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            loading={isPending}
            onClick={async () => {
              setPending(true)
              const ok = await onConfirm()
              setPending(false)
              if (ok) setOpen(false)
            }}
          >
            Confirm
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConfirmWithNote({
  label,
  title,
  description,
  variant,
  onConfirm,
}: {
  label: string
  title: string
  description: string
  variant: 'outline' | 'destructive'
  onConfirm: (notes: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [isPending, setPending] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Note for the agent"
          rows={3}
        />
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            loading={isPending}
            onClick={async () => {
              setPending(true)
              const ok = await onConfirm(notes)
              setPending(false)
              if (ok) setOpen(false)
            }}
          >
            {label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
