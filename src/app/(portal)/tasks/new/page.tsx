import type { Metadata } from 'next'

import { requireCustomer } from '@/lib/auth'
import { getCategories, getLiveCities } from '@/database/reference'
import { NewTaskForm } from '@/components/tasks/new-task-form'

export const metadata: Metadata = {
  title: 'Request a Task',
  robots: { index: false, follow: false },
}

export default async function NewTaskPage() {
  const user = await requireCustomer()
  const [categories, cities] = await Promise.all([getCategories(), getLiveCities()])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-7">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Request a Task
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          Describe what you need done. Concierge Go will review it and send you a transparent
          quote before anything is scheduled.
        </p>
      </div>
      <NewTaskForm categories={categories} cities={cities} defaultPhone={user.profile.phone} />
    </div>
  )
}
