'use client'

import { useActionState } from 'react'

import { updateProfileAction, type ProfileActionResult } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError, FormSuccess } from '@/components/shared/field'
import { AvatarUploader } from '@/components/profile/avatar-uploader'
import type { CityRow, ProfileRow } from '@/types/database'

export function ProfileForm({ profile, cities }: { profile: ProfileRow; cities: CityRow[] }) {
  const [state, formAction, isPending] = useActionState<ProfileActionResult | null, FormData>(
    updateProfileAction,
    null,
  )
  const currentCitySlug = cities.find((city) => city.id === profile.default_city_id)?.slug

  return (
    <div className="space-y-6">
      <AvatarUploader
        profileId={profile.id}
        fullName={profile.full_name}
        avatarUrl={profile.avatar_url}
      />

      <form action={formAction} className="space-y-4">
        <FormError message={state && !state.ok ? state.error : null} />
        <FormSuccess message={state?.ok ? state.message : null} />

        <Field
          name="fullName"
          label="Full name"
          required
          error={state && !state.ok ? state.fieldErrors?.fullName : null}
        >
          {(props) => <Input {...props} name="fullName" defaultValue={profile.full_name} required />}
        </Field>

        <Field name="email" label="Email">
          {(props) => <Input {...props} value={profile.email} disabled readOnly />}
        </Field>

        <Field
          name="phone"
          label="Phone number"
          error={state && !state.ok ? state.fieldErrors?.phone : null}
        >
          {(props) => (
            <Input {...props} name="phone" type="tel" defaultValue={profile.phone ?? ''} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="citySlug" label="Default city">
            {() => (
              <Select name="citySlug" defaultValue={currentCitySlug ?? cities[0]?.slug}>
                <SelectTrigger id="field-citySlug">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.slug} value={city.slug}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field name="area" label="Default area">
            {(props) => (
              <Input {...props} name="area" defaultValue={profile.default_area ?? ''} />
            )}
          </Field>
        </div>

        <input type="hidden" name="avatarUrl" value={profile.avatar_url ?? ''} />

        <Button type="submit" loading={isPending}>
          Save changes
        </Button>
      </form>
    </div>
  )
}
