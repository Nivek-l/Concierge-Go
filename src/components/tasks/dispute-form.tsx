'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createDisputeAction, type DisputeResult } from '@/actions/tasks'
import { DISPUTE_REASON_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { DISPUTE_REASONS, type DisputeReason } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormError } from '@/components/shared/field'
import { FileUploader, type UploadedFileMeta } from '@/components/shared/file-uploader'
import { toast } from '@/components/ui/sonner'

export function DisputeForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [reason, setReason] = useState<DisputeReason>('not_completed')
  const [attachment, setAttachment] = useState<UploadedFileMeta[]>([])
  const [state, formAction, isPending] = useActionState<DisputeResult | null, FormData>(
    createDisputeAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'Report submitted.')
      router.push(`/tasks/${taskId}`)
    }
  }, [state, router, taskId])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="attachment" value={JSON.stringify(attachment[0] ?? null)} />

      <FormError message={state && !state.ok ? state.error : null} />

      <div>
        <span className="mb-2 block text-sm font-medium">What went wrong?</span>
        <div className="space-y-2">
          {DISPUTE_REASONS.map((value) => {
            const meta = DISPUTE_REASON_META[value]
            const active = reason === value
            return (
              <button
                type="button"
                key={value}
                onClick={() => setReason(value)}
                className={cn(
                  'block w-full rounded-lg border p-3 text-left transition-colors',
                  active ? 'border-primary bg-primary-subtle' : 'hover:border-primary/40',
                )}
              >
                <p className="text-sm font-semibold">{meta.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                  {meta.description}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <Field
        name="description"
        label="Tell us what happened"
        required
        error={fieldErrors?.description}
      >
        {(props) => (
          <Textarea
            {...props}
            name="description"
            rows={5}
            placeholder="Describe what you expected and what actually happened"
            required
          />
        )}
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          Attach evidence <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </span>
        <FileUploader
          kind="attachment"
          entityId={taskId}
          value={attachment}
          onChange={setAttachment}
          label="Attach a photo or document"
        />
      </div>

      <Button type="submit" size="lg" variant="destructive" loading={isPending}>
        Submit report
      </Button>
    </form>
  )
}
