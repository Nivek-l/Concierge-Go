'use client'

import { useRef, useState } from 'react'
import { File as FileIcon, Loader2, Paperclip, X } from 'lucide-react'

import { formatFileSize } from '@/lib/format'
import { acceptAttribute, buildStoragePath, validateUpload } from '@/services/storage'
import { UPLOAD_LIMITS, type UploadKind } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'

export interface UploadedFileMeta {
  storagePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

/**
 * Direct-to-storage uploader.
 *
 * Files never pass through a server action — only their metadata does, once
 * the upload succeeds. `entityId` is the folder the storage policies check
 * (a task id for attachments/proof, a profile id for avatars), so it must
 * already exist before this is used.
 */
export function FileUploader({
  kind,
  entityId,
  value,
  onChange,
  multiple = false,
  disabled,
  label = 'Attach a file',
}: {
  kind: UploadKind
  entityId: string
  value: UploadedFileMeta[]
  onChange: (files: UploadedFileMeta[]) => void
  multiple?: boolean
  disabled?: boolean
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const bucket = UPLOAD_LIMITS[kind].bucket
  const limits = UPLOAD_LIMITS[kind].maxFiles

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    if (!multiple && files.length > 1) {
      toast.error('Choose a single file.')
      return
    }

    if (value.length + files.length > limits) {
      toast.error(`You can attach up to ${limits} file${limits === 1 ? '' : 's'}.`)
      return
    }

    setUploading(true)
    const supabase = createClient()
    const uploaded: UploadedFileMeta[] = []

    for (const file of files) {
      const validation = validateUpload(file, kind)
      if (!validation.ok) {
        toast.error(validation.error)
        continue
      }

      const path = buildStoragePath(entityId, file.name)
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

      if (error) {
        toast.error(`${file.name} could not be uploaded. ${error.message}`)
        continue
      }

      uploaded.push({
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      })
    }

    if (uploaded.length > 0) {
      onChange(multiple ? [...value, ...uploaded] : uploaded)
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2.5">
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={acceptAttribute(kind)}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
        disabled={disabled || uploading}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading || value.length >= limits}
      >
        {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Paperclip aria-hidden />}
        {uploading ? 'Uploading…' : label}
      </Button>

      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((file, index) => (
            <li
              key={file.storagePath}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{file.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.sizeBytes)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive"
                aria-label={`Remove ${file.fileName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
