'use server'

import { revalidatePath } from 'next/cache'

import { requireUserAction } from '@/lib/auth'
import { logError, toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { addressSchema, fieldErrorsFrom, updateProfileSchema, uuidSchema } from '@/lib/validations'
import { actionError, actionOk, type ActionResult } from '@/types/domain'

/**
 * Profile, saved addresses and notification actions.
 *
 * Note what is *not* here: nothing can change a role, a suspension flag or an
 * email. A database trigger (guard_profile_update) restores those columns for
 * any non-admin write, so even a crafted request cannot escalate.
 */

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

export type ProfileActionResult = ActionResult<{ updated: boolean }>

export async function updateProfileAction(
  _prev: ProfileActionResult | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  const parsed = updateProfileSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Please check the details below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    let cityId: string | null = user.profile.default_city_id
    if (parsed.data.citySlug) {
      const { data: city } = await supabase
        .from('cities')
        .select('id')
        .eq('slug', parsed.data.citySlug)
        .maybeSingle()
      cityId = (city?.id as string | undefined) ?? null
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        default_city_id: cityId,
        default_area: parsed.data.area,
        avatar_url: parsed.data.avatarUrl || null,
      })
      .eq('id', user.id)

    if (error) throw error

    revalidatePath('/profile')
    revalidatePath('/', 'layout')
    return actionOk({ updated: true }, 'Your profile has been updated.')
  } catch (error) {
    logError('profile.update', error)
    return actionError(toUserMessage(error, 'We could not save your profile.'))
  }
}

/** Records the avatar path after a direct-to-storage upload. */
export async function updateAvatarAction(publicUrl: string): Promise<ProfileActionResult> {
  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl || null })
      .eq('id', user.id)

    if (error) throw error

    revalidatePath('/profile')
    revalidatePath('/', 'layout')
    return actionOk({ updated: true }, 'Photo updated.')
  } catch (error) {
    logError('profile.updateAvatar', error)
    return actionError(toUserMessage(error, 'We could not update your photo.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Addresses                                                                  */
/* -------------------------------------------------------------------------- */

export type AddressActionResult = ActionResult<{ id: string }>

export async function saveAddressAction(
  _prev: AddressActionResult | null,
  formData: FormData,
): Promise<AddressActionResult> {
  const raw = readForm(formData)
  const parsed = addressSchema.safeParse({
    ...raw,
    id: raw.id ? String(raw.id) : undefined,
    isDefault: raw.isDefault === 'on' || raw.isDefault === 'true',
  })

  if (!parsed.success) {
    return actionError('Please check the address details.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    const { data: city } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', parsed.data.citySlug)
      .maybeSingle()

    const payload = {
      profile_id: user.id,
      label: parsed.data.label,
      street_address: parsed.data.streetAddress,
      area: parsed.data.area,
      landmark: parsed.data.landmark,
      city_id: (city?.id as string | undefined) ?? null,
      contact_name: parsed.data.contactName,
      contact_phone: parsed.data.contactPhone,
      is_default: parsed.data.isDefault,
    }

    // A partial unique index enforces one default per customer, so clear the
    // previous one first.
    if (parsed.data.isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('profile_id', user.id)
        .eq('is_default', true)
    }

    if (parsed.data.id) {
      const { data, error } = await supabase
        .from('addresses')
        .update(payload)
        .eq('id', parsed.data.id)
        .eq('profile_id', user.id) // RLS covers this; belt and braces.
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) return actionError('That address could not be found.')

      revalidatePath('/profile')
      return actionOk({ id: data.id as string }, 'Address updated.')
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert(payload)
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/profile')
    return actionOk({ id: data.id as string }, 'Address saved.')
  } catch (error) {
    logError('profile.saveAddress', error)
    return actionError(toUserMessage(error, 'We could not save that address.'))
  }
}

export async function deleteAddressAction(addressId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = uuidSchema.safeParse(addressId)
  if (!parsed.success) return actionError('That address is not valid.')

  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', parsed.data)
      .eq('profile_id', user.id)

    if (error) throw error

    revalidatePath('/profile')
    return actionOk({ id: parsed.data }, 'Address removed.')
  } catch (error) {
    logError('profile.deleteAddress', error)
    return actionError(toUserMessage(error, 'We could not remove that address.'))
  }
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = uuidSchema.safeParse(notificationId)
  if (!parsed.success) return actionError('That notification is not valid.')

  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', parsed.data)
      .eq('profile_id', user.id)
      .is('read_at', null)

    if (error) throw error

    revalidatePath('/notifications')
    revalidatePath('/', 'layout')
    return actionOk({ id: parsed.data })
  } catch (error) {
    logError('profile.markNotificationRead', error)
    return actionError(toUserMessage(error))
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUserAction()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', user.id)
      .is('read_at', null)
      .select('id')

    if (error) throw error

    revalidatePath('/notifications')
    revalidatePath('/', 'layout')
    return actionOk({ count: data?.length ?? 0 }, 'All notifications marked as read.')
  } catch (error) {
    logError('profile.markAllNotificationsRead', error)
    return actionError(toUserMessage(error))
  }
}
