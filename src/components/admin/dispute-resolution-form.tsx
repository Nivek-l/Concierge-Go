'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { resolveDisputeAction } from '@/actions/admin'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import type { DisputeStatus } from '@/types/database'

export function DisputeResolutionForm({ disputeId }: { disputeId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<DisputeStatus>('resolved')
  const [finalTaskStatus, setFinalTaskStatus] = useState('completed')
  const [note, setNote] = useState('')
  const [isPending, setPending] = useState(false)

  async function handleSubmit() {
    if (note.trim().length < 5) {
      toast.error('Add a brief resolution note.')
      return
    }

    setPending(true)
    const formData = new FormData()
    formData.set('disputeId', disputeId)
    formData.set('status', status)
    formData.set('resolutionNote', note.trim())
    if (status === 'resolved') formData.set('finalTaskStatus', finalTaskStatus)

    const result = await resolveDisputeAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Report updated.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <RadioGroup value={status} onValueChange={(value) => setStatus(value as DisputeStatus)} className="flex flex-wrap gap-4">
        {(['under_review', 'resolved', 'rejected'] as const).map((value) => (
          <label key={value} className="flex items-center gap-1.5 text-sm">
            <RadioGroupItem value={value} />
            {value === 'under_review' ? 'Keep reviewing' : value === 'resolved' ? 'Resolve' : 'Reject'}
          </label>
        ))}
      </RadioGroup>

      {status === 'resolved' ? (
        <Select value={finalTaskStatus} onValueChange={setFinalTaskStatus}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Mark task completed</SelectItem>
            <SelectItem value="cancelled">Cancel the task</SelectItem>
            <SelectItem value="in_progress">Send back for more work</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Resolution note — visible to the customer"
        rows={3}
      />

      <Button loading={isPending} onClick={handleSubmit}>
        Save resolution
      </Button>
    </div>
  )
}
