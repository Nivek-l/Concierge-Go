import 'server-only'

import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type { AddressRow, NotificationRow } from '@/types/database'
import type { AddressWithCity } from '@/types/domain'

import { getReferenceMaps } from './reference'

/* -------------------------------------------------------------------------- */
/* Addresses                                                                  */
/* -------------------------------------------------------------------------- */

export async function getAddresses(profileId: string): Promise<AddressWithCity[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('profile_id', profileId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    const { cityById } = await getReferenceMaps()
    return ((data ?? []) as AddressRow[]).map((address) => ({
      ...address,
      city_name: address.city_id ? (cityById.get(address.city_id)?.name ?? null) : null,
    }))
  } catch (error) {
    logError('profile.getAddresses', error, { profileId })
    return []
  }
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function getNotifications(
  profileId: string,
  options?: { limit?: number; unreadOnly?: boolean },
): Promise<NotificationRow[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 30)

    if (options?.unreadOnly) query = query.is('read_at', null)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as NotificationRow[]
  } catch (error) {
    logError('profile.getNotifications', error, { profileId })
    return []
  }
}

export async function getUnreadNotificationCount(profileId: string): Promise<number> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .is('read_at', null)

    if (error) throw error
    return count ?? 0
  } catch (error) {
    logError('profile.getUnreadNotificationCount', error, { profileId })
    return 0
  }
}
