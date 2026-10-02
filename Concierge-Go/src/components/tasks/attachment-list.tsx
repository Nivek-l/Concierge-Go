import { File as FileIcon, FileText, Image as ImageIcon } from 'lucide-react'

import { PROOF_TYPE_META } from '@/lib/constants'
import { formatDateTime, formatFileSize } from '@/lib/format'
import type { TaskAttachmentRow, TaskProofRow } from '@/types/database'

function isImage(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('image/'))
}

export function AttachmentList({
  title,
  items,
  fileUrls,
  emptyLabel,
}: {
  title: string
  items: TaskAttachmentRow[]
  fileUrls: Record<string, string>
  emptyLabel?: string
}) {
  if (items.length === 0) {
    if (!emptyLabel) return null
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <FileTile
              url={fileUrls[item.storage_path]}
              fileName={item.file_name}
              mimeType={item.mime_type}
              sizeBytes={item.size_bytes}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProofList({
  proofs,
  fileUrls,
}: {
  proofs: TaskProofRow[]
  fileUrls: Record<string, string>
}) {
  if (proofs.length === 0) {
    return <p className="text-sm text-muted-foreground">No proof has been submitted yet.</p>
  }

  return (
    <ul className="space-y-3">
      {proofs.map((proof) => {
        const meta = PROOF_TYPE_META[proof.proof_type]
        return (
          <li key={proof.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(proof.created_at)}</p>
            </div>
            {proof.note ? (
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{proof.note}</p>
            ) : null}
            {proof.storage_path ? (
              <div className="mt-2.5 max-w-[10rem]">
                <FileTile
                  url={fileUrls[proof.storage_path]}
                  fileName={proof.file_name}
                  mimeType={proof.mime_type}
                  sizeBytes={proof.size_bytes}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function FileTile({
  url,
  fileName,
  mimeType,
  sizeBytes,
}: {
  url?: string
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
}) {
  const Icon = isImage(mimeType) ? ImageIcon : mimeType === 'application/pdf' ? FileText : FileIcon

  const content = isImage(mimeType) && url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={fileName ?? 'Attachment'}
      loading="lazy"
      decoding="async"
      className="h-24 w-full rounded-lg object-cover"
    />
  ) : (
    <div className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-muted/40">
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
    </div>
  )

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
    >
      {content}
      <div className="space-y-0.5 p-2">
        <p className="truncate text-xs font-medium">{fileName ?? 'File'}</p>
        {sizeBytes ? (
          <p className="text-[10px] text-muted-foreground">{formatFileSize(sizeBytes)}</p>
        ) : null}
      </div>
    </a>
  )
}
