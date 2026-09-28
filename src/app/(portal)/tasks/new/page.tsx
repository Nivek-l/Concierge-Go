import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardPenLine, Sparkles } from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getCategories, getLiveCities } from '@/database/reference'
import { NewTaskForm } from '@/components/tasks/new-task-form'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'New Task',
  robots: { index: false, follow: false },
}

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; source?: string }>
}) {
  const user = await requireCustomer()
  const params = await searchParams
  const showForm = params.mode === 'manual' || params.source === 'ai'

  if (!showForm) {
    return (
      <div className="mx-auto max-w-4xl space-y-7">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            New task
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            How would you like to request it?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground text-pretty">
            Use Concierge AI to explain the task naturally, or fill in the regular request form yourself.
            Both paths create the same Concierge Go task and you review the details before submitting.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/tasks/ai" className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full border-primary/25 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/45 group-hover:shadow-lift">
              <CardContent className="flex h-full flex-col p-6 sm:p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-6 font-display text-xl font-bold">Describe it to Concierge AI</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  Chat normally about what you need. The assistant asks for missing details and prepares the regular form for your review.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Start with AI <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/tasks/new?mode=manual" className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-lift">
              <CardContent className="flex h-full flex-col p-6 sm:p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <ClipboardPenLine className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-6 font-display text-xl font-bold">Fill it in myself</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  Open the existing structured request form and enter the task details yourself. None of the form fields have been removed or changed.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  Open request form <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    )
  }

  const [categories, cities] = await Promise.all([getCategories(), getLiveCities()])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-7">
        <Link href="/tasks/new" className="text-xs font-semibold text-primary hover:underline">
          ← Choose another request method
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {params.source === 'ai' ? 'Review your request' : 'Request a Task'}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          {params.source === 'ai'
            ? 'Concierge AI has prepared the regular request form. Check every detail before submitting.'
            : 'Describe what you need done. Concierge Go will review it and send you a transparent quote before anything is scheduled.'}
        </p>
      </div>
      <NewTaskForm categories={categories} cities={cities} defaultPhone={user.profile.phone} />
    </div>
  )
}
