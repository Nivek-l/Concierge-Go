'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'

import { updateAvatarAction } from '@/actions/profile'
import { initials } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { UPLOAD_LIMITS } from '@/lib/constants'
import { buildStoragePath, validateUpload } from '@/services/storage'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/components/ui/sonner'

export function AvatarUploader({
  profileId,
  fullName,
  avatarUrl,
}: {
  profileId: string
  fullName: string
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(avatarUrl)

  async function handleFile(file: File | undefined) {
    if (!file) return

    const validation = validateUpload(file, 'avatar')
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    setUploading(true)
    const supabase = createClient()
    const path = buildStoragePath(profileId, file.name)

    const { error: uploadError } = await supabase.storage
      .from(UPLOAD_LIMITS.avatar.bucket)
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })

    if (uploadError) {
      toast.error('Your photo could not be uploaded.')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(UPLOAD_LIMITS.avatar.bucket).getPublicUrl(path)

    const result = await updateAvatarAction(data.publicUrl)
    setUploading(false)

    if (result.ok) {
      setPreview(data.publicUrl)
      toast.success('Photo updated.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={preview ?? undefined} alt="" />
        <AvatarFallback className="text-lg">{initials(fullName)}</AvatarFallback>
      </Avatar>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
        <Camera className="h-3.5 w-3.5" aria-hidden />
        {uploading ? 'Uploading…' : 'Change photo'}
        <input
          type="file"
          accept={UPLOAD_LIMITS.avatar.accept.join(',')}
          className="hidden"
          disabled={uploading}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </label>
    </div>
  )
}
