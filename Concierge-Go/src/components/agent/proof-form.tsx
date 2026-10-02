'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { submitProofAction, type ProofActionResult } from '@/actions/agent'
import { PROOF_TYPE_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PROOF_TYPES, type ProofType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/shared/field'
import { FileUploader, type UploadedFileMeta } from '@/components/shared/file-uploader'
import { toast } from '@/components/ui/sonner'

export function ProofForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [proofType, setProofType] = useState<ProofType>('photo')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<UploadedFileMeta[]>([])
  const [state, formAction, isPending] = useActionState<ProofActionResult | null, FormData>(
    submitProofAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? 'Proof added.')
      setFile([])
      setNote('')
      router.refresh()
    }
  }, [state, router])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined
  const meta = PROOF_TYPE_META[proofType]
  const attachment = file[0]

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="proofType" value={proofType} />
      <input type="hidden" name="storagePath" value={attachment?.storagePath ?? ''} />
      <input type="hidden" name="fileName" value={attachment?.fileName ?? ''} />
      <input type="hidden" name="mimeType" value={attachment?.mimeType ?? ''} />
      <input type="hidden" name="sizeBytes" value={attachment?.sizeBytes ?? ''} />

      <FormError message={state && !state.ok ? state.error : null} />

      <div>
        <span className="mb-2 block text-sm font-medium">Type of proof</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROOF_TYPES.map((value) => {
            const active = proofType === value
            return (
              <button
                type="button"
                key={value}
                onClick={() => setProofType(value)}
                className={cn(
                  'rounded-lg border p-2.5 text-left text-xs transition-colors',
                  active ? 'border-primary bg-primary-subtle' : 'hover:border-primary/40',
                )}
              >
                <p className="font-semibold">{PROOF_TYPE_META[value].label}</p>
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{meta.description}</p>
      </div>

      {meta.requiresFile ? (
        <FileUploader
          kind="proof"
          entityId={taskId}
          value={file}
          onChange={setFile}
          label={`Upload ${meta.label.toLowerCase()}`}
        />
      ) : null}

      <Textarea
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={
          proofType === 'text'
            ? 'Describe exactly what you did, at least a sentence.'
            : 'Add a note about this proof (optional)'
        }
        rows={3}
      />
      {fieldErrors?.note ? <p className="text-xs font-medium text-destructive">{fieldErrors.note[0]}</p> : null}
      {fieldErrors?.storagePath ? (
        <p className="text-xs font-medium text-destructive">{fieldErrors.storagePath[0]}</p>
      ) : null}

      <Button type="submit" loading={isPending}>
        Add proof
      </Button>
    </form>
  )
}
