'use client'

import { MapPin, Pencil, Star, Trash2 } from 'lucide-react'

import { deleteAddressAction } from '@/actions/profile'
import { AddressFormDialog } from '@/components/profile/address-form-dialog'
import { ConfirmAction } from '@/components/shared/confirm-action'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AddressWithCity } from '@/types/domain'
import type { CityRow } from '@/types/database'

export function AddressList({
  addresses,
  cities,
}: {
  addresses: AddressWithCity[]
  cities: CityRow[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Saved addresses</p>
        <AddressFormDialog cities={cities} />
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Save an address to fill it in faster next time you request a task."
        />
      ) : (
        <ul className="space-y-2.5">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{address.label}</p>
                  {address.is_default ? (
                    <Badge variant="progress">
                      <Star className="h-2.5 w-2.5" /> Default
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {address.street_address}
                  {address.area ? `, ${address.area}` : ''}
                  {address.city_name ? `, ${address.city_name}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <AddressFormDialog
                  cities={cities}
                  address={address}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Edit address">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
                <ConfirmAction
                  title="Remove this address?"
                  description={`"${address.label}" will be removed from your saved addresses.`}
                  confirmLabel="Remove"
                  onConfirm={() => deleteAddressAction(address.id)}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Remove address">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
