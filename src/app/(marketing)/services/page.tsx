import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'

import { LAUNCH_CITY } from '@/lib/constants'
import { getCategories } from '@/database/reference'
import { Button } from '@/components/ui/button'
import { CATEGORY_ICONS } from '@/components/marketing/category-grid'
import { Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'What we handle',
  description:
    'Documents, shopping, errands, business tasks, property verification and events — handled by verified Go Agents in Calabar. Or just describe what you need.',
  alternates: { canonical: '/services' },
}

/**
 * /services — the catalogue, deliberately secondary.
 *
 * The page leads with "describe what you need" and treats the categories as
 * illustration, so nobody has to hunt through a list to get started.
 */
export default async function ServicesPage() {
  const categories = await getCategories()

  return (
    <>
      <section className="border-b bg-muted/30">
        <div className="container py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              What we handle
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              You don&apos;t need to find your task in a list
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground text-pretty sm:text-lg">
              Describe what you need in your own words and operations works out the rest. The
              categories below are just the requests we see most often in {LAUNCH_CITY.name}.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/tasks/new">
                  Describe what you need
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container py-14 sm:py-20">
          <div className="space-y-12">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.icon] ?? Sparkles

              return (
                <div
                  key={category.id}
                  id={category.slug}
                  className="grid gap-6 border-b pb-12 last:border-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-12"
                >
                  <div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-subtle">
                      <Icon className="h-5.5 w-5.5 text-primary" aria-hidden />
                    </span>
                    <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
                      {category.name}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-primary">{category.tagline}</p>
                    <p className="mt-3 text-sm text-muted-foreground text-pretty">
                      {category.description}
                    </p>

                    <Button asChild variant="outline" size="sm" className="mt-5">
                      <Link href={`/tasks/new?category=${category.slug}`}>
                        Request this
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      For example
                    </p>
                    <ul className="mt-3.5 space-y-2.5">
                      {category.examples.map((example) => (
                        <li key={example} className="flex items-start gap-2.5 text-sm text-pretty">
                          <span
                            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                            aria-hidden
                          />
                          {example}
                        </li>
                      ))}
                    </ul>

                    {category.requires_proof ? (
                      <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground text-pretty">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Tasks in this category close with proof — a photo, receipt, document or
                        video attached to your task.
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="container py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Not sure it fits a category?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground text-pretty">
            Describe it anyway. If it is legal, specific and can be done by a person in{' '}
            {LAUNCH_CITY.name}, operations will tell you whether we can handle it and what it costs
            — before you pay anything.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/tasks/new">
              Request a Task
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
