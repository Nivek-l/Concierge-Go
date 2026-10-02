import 'server-only'

import { SIGNED_URL_TTL_SECONDS } from '@/lib/constants'
import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'

/**
 * Signed URLs for private buckets.
 *
 * Generated with the *caller's* client, so Storage RLS applies: a user who
 * cannot read the object gets no URL. URLs are short-lived and never stored.
 */

export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch (error) {
    logError('storage.createSignedUrl', error, { bucket, path })
    return null
  }
}

export interface SignableFile {
  bucket: string
  storage_path: string | null
}

/** Sign a batch in one round trip per bucket. Returns path → URL. */
export async function createSignedUrls(
  files: SignableFile[],
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, string>> {
  const withPaths = files.filter((file): file is SignableFile & { storage_path: string } =>
    Boolean(file.storage_path),
  )
  if (withPaths.length === 0) return {}

  const byBucket = new Map<string, string[]>()
  for (const file of withPaths) {
    const paths = byBucket.get(file.bucket) ?? []
    paths.push(file.storage_path)
    byBucket.set(file.bucket, paths)
  }

  const result: Record<string, string> = {}

  try {
    const supabase = await createClient()

    await Promise.all(
      Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, expiresIn)
        if (error || !data) return
        for (const entry of data) {
          if (entry.signedUrl && entry.path) result[entry.path] = entry.signedUrl
        }
      }),
    )
  } catch (error) {
    logError('storage.createSignedUrls', error)
  }

  return result
}

/** Public bucket (avatars) — no signing needed. */
export function publicUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}
