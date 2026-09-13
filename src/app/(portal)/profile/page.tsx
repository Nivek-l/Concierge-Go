import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { getAddresses } from '@/database/profile'
import { getCities } from '@/database/reference'
import { formatFriendlyDate } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/profile/profile-form'
import { AddressList } from '@/components/profile/address-list'

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false, follow: false },
}

export default async function ProfilePage() {
  const user = await requireUser()
  const [addresses, cities] = await Promise.all([getAddresses(user.id), getCities()])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Member since {formatFriendlyDate(user.profile.created_at)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={user.profile} cities={cities} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <AddressList addresses={addresses} cities={cities} />
        </CardContent>
      </Card>
    </div>
  )
}
