import 'server-only'

import webpush from 'web-push'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/env'
import { logError } from '@/lib/errors'

export async function sendPush(profileId: string, payload: { title: string; body: string; link?: string | null; taskId?: string | null }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return
  webpush.setVapidDetails(`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'hello@conciergego.ng'}`, publicKey, privateKey)
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh_key, auth_key').eq('profile_id', profileId)
  if (error) return logError('notifications.push.lookup', error, { profileId })

  await Promise.allSettled((data ?? []).map(async (item) => {
    try {
      await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh_key, auth: item.auth_key } }, JSON.stringify({ ...payload, link: payload.link ? new URL(payload.link, getAppUrl()).pathname : '/notifications' }))
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', item.id)
      else logError('notifications.push.send', error, { profileId })
    }
  }))
}
