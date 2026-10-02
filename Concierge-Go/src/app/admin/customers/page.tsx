import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, Users } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getCustomerDirectory } from '@/database/admin'
import { formatFriendlyDate, formatNaira, initials } from '@/lib/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/empty-state'

export const metadata: Metadata = {
  title: 'Manage customers',
  robots: { index: false, follow: false },
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q: search = '' } = await searchParams
  const customers = await getCustomerDirectory({ search })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Manage customers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {customers.length} customer{customers.length === 1 ? '' : 's'}
        </p>
      </div>

      <form className="flex gap-2" action="/admin/customers">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Search name, email or phone" className="pl-9" />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" description="Try a different search term." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {customers.map((item) => (
                <li key={item.profile.id}>
                  <Link
                    href={`/admin/customers/${item.profile.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={item.profile.avatar_url ?? undefined} alt="" />
                        <AvatarFallback className="text-xs">{initials(item.profile.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.profile.full_name}</p>
                          {item.profile.is_suspended ? <Badge variant="danger">Suspended</Badge> : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.profile.email}
                          {item.cityName ? ` · ${item.cityName}` : ''} · Joined{' '}
                          {formatFriendlyDate(item.profile.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                      <span className="text-sm font-medium">{item.taskCount} tasks</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNaira(item.totalSpentKobo)} spent
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
