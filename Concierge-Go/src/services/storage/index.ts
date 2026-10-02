import { UPLOAD_LIMITS, type UploadKind } from '@/lib/constants'
import { formatFileSize } from '@/lib/format'

/**
 * Storage helpers shared by client uploaders and server validators.
 *
 * Files go straight from the browser to Supabase Storage (so nothing large
 * passes through a serverless function), and only the metadata travels through
 * a server action. Because the client is not trustworthy, every rule here is
 * enforced three times: in the browser for a fast message, in the server action
 * via Zod, and in the storage bucket configuration itself.
 *
 * Object paths are always `<entity-id>/<random>-<filename>` so a storage policy
 * can resolve the owning task from the first path segment.
 */

export interface UploadValidationResult {
  ok: boolean
  error?: string
}

export function validateUpload(file: File, kind: UploadKind): UploadValidationResult {
  const limits = UPLOAD_LIMITS[kind]

  if (file.size <= 0) {
    return { ok: false, error: 'That file appears to be empty.' }
  }

  if (file.size > limits.maxBytes) {
    return {
      ok: false,
      error: `${file.name} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(limits.maxBytes)}.`,
    }
  }

  const mime = (file.type || '').toLowerCase()
  const accepted = limits.accept as readonly string[]

  if (!mime || !accepted.includes(mime)) {
    return {
      ok: false,
      error: `${file.name} is not a supported file type. ${limits.hint}`,
    }
  }

  return { ok: true }
}

/** Strip anything that could confuse a storage path or a download header. */
export function sanitizeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(-80)
  return cleaned || 'file'
}

export function buildStoragePath(entityId: string, fileName: string) {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${entityId}/${unique}-${sanitizeFileName(fileName)}`
}

/** The `accept` attribute for a file input. */
export function acceptAttribute(kind: UploadKind) {
  return (UPLOAD_LIMITS[kind].accept as readonly string[]).join(',')
}

export function isImageMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith('image/'))
}

export function isVideoMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith('video/'))
}

export function isPdfMime(mime: string | null | undefined) {
  return mime === 'application/pdf'
}
