'use client'

import { useActionState, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { saveAddressAction, type AddressActionResult } from '@/actions/profile'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError } from '@/components/shared/field'
import type { AddressWithCity } from '@/types/domain'
import type { CityRow } from '@/types/database'

export function AddressFormDialog({
  cities,
  address,
  trigger,
}: {
  cities: CityRow[]
  address?: AddressWithCity
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState<AddressActionResult | null, FormData>(
    saveAddressAction,
    null,
  )

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            Add address
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{address ? 'Edit address' : 'Add an address'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {address ? <input type="hidden" name="id" value={address.id} /> : null}
          <FormError message={state && !state.ok ? state.error : null} />

          <Field name="label" label="Label" required error={fieldErrors?.label}>
            {(props) => (
              <Input {...props} name="label" placeholder="Home, Office…" defaultValue={address?.label} required />
            )}
          </Field>

          <Field
            name="streetAddress"
            label="Street address"
            required
            error={fieldErrors?.streetAddress}
          >
            {(props) => (
              <Input
                {...props}
                name="streetAddress"
                defaultValue={address?.street_address}
                required
              />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="citySlug" label="City" required>
              {() => (
                <Select
                  name="citySlug"
                  defaultValue={
                    cities.find((c) => c.id === address?.city_id)?.slug ?? cities[0]?.slug
                  }
                >
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
            <Field name="area" label="Area">
              {(props) => <Input {...props} name="area" defaultValue={address?.area ?? ''} />}
            </Field>
          </div>

          <Field name="landmark" label="Landmark">
            {(props) => (
              <Input {...props} name="landmark" defaultValue={address?.landmark ?? ''} />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="contactName" label="Contact name">
              {(props) => (
                <Input {...props} name="contactName" defaultValue={address?.contact_name ?? ''} />
              )}
            </Field>
            <Field name="contactPhone" label="Contact phone">
              {(props) => (
                <Input
                  {...props}
                  name="contactPhone"
                  type="tel"
                  defaultValue={address?.contact_phone ?? ''}
                />
              )}
            </Field>
          </div>

          <div className="flex items-center gap-2.5">
            <Checkbox id="isDefault" name="isDefault" defaultChecked={address?.is_default} />
            <label htmlFor="isDefault" className="text-sm text-muted-foreground">
              Set as default address
            </label>
          </div>

          <DialogFooter>
            <Button type="submit" loading={isPending}>
              Save address
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
