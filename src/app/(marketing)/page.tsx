import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Camera,
  MapPin,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { APP_TAGLINE, LAUNCH_CITY, TRUST_POINTS } from '@/lib/constants'
import { getCategories } from '@/database/reference'
import { Button } from '@/components/ui/button'
import { CategoryGrid } from '@/components/marketing/category-grid'
import { TaskRequestPreview } from '@/components/marketing/task-request-preview'
import { WorkflowSteps, WorkflowStrip } from '@/components/marketing/workflow-steps'

export const metadata: Metadata = {
  title: 'Concierge Go | You Ask. We Handle It.',
  description:
    'Concierge Go helps you get real-world tasks done by connecting you with verified local agents in Calabar.',
  alternates: { canonical: '/' },
}

const TRUST_ICONS: Record<string, LucideIcon> = { ShieldCheck, Wallet, Camera }

export default async function HomePage() {
  const categories = await getCategories()

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-grid" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" aria-hidden />

        <div className="container relative py-14 sm:py-20 lg:py-24">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
                Now live in {LAUNCH_CITY.label}
              </span>

              <h1 className="mt-6 font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4rem]">
                Concierge Go
              </h1>

              <p className="mt-3 font-display text-xl font-semibold text-primary sm:text-2xl">
                {APP_TAGLINE}
              </p>

              <p className="mt-5 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
                Need something done in {LAUNCH_CITY.name} but can&apos;t be there? Request a trusted
                Go Agent to handle it for you.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/tasks/new">
                    Request a Task
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/become-an-agent">Become a Go Agent</Link>
                </Button>
              </div>

              <div className="mt-10 border-t pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How every task runs
                </p>
                <WorkflowStrip className="mt-2.5" />
              </div>
            </div>

            <div className="animate-fade-up lg:sticky lg:top-24 [animation-delay:120ms]">
              <TaskRequestPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Trust                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b bg-card">
        <div className="container py-12 sm:py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            {TRUST_POINTS.map((point) => {
              const Icon = TRUST_ICONS[point.icon] ?? ShieldCheck
              return (
                <div key={point.title} className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle">
                    <Icon className="h-5 w-5 text-accent" aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold tracking-tight">
                      {point.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground text-pretty">{point.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What we handle                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b">
        <div className="container py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              What we handle
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              If a person in {LAUNCH_CITY.name} can do it, you can ask for it
            </h2>
            <p className="mt-4 text-base text-muted-foreground text-pretty">
              These are the categories we see most. You don&apos;t have to pick one — describe your
              task in your own words and operations will work out the rest.
            </p>
          </div>

          <CategoryGrid categories={categories} className="mt-10" />

          <div className="mt-10">
            <Button asChild variant="outline">
              <Link href="/services">
                See examples of each
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b bg-muted/30">
        <div className="container py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Request → Quote → Pay → Track → Proof → Done
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              You always know what is happening
            </h2>
            <p className="mt-4 text-base text-muted-foreground text-pretty">
              Every task moves through the same six steps. You see the price before you pay, the
              agent handling it once assigned, and the proof before it closes.
            </p>
          </div>

          <WorkflowSteps className="mt-12" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Agents                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <div className="container py-16 sm:py-20">
          <div className="overflow-hidden rounded-2xl border bg-primary text-primary-foreground">
            <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/70">
                  For Go Agents
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Earn by handling tasks near you
                </h2>
                <p className="mt-4 max-w-lg text-primary-foreground/85 text-pretty">
                  If you know {LAUNCH_CITY.name} and you are reliable, become a verified Go Agent.
                  Pick tasks that fit your day, get paid per completed task, and build a rating that
                  earns you more work.
                </p>

                <ul className="mt-6 space-y-2.5 text-sm text-primary-foreground/85">
                  {[
                    'Choose the tasks you take from the job board',
                    'Payment is confirmed before you set out',
                    'Clear payout on every task, before you accept it',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground/60" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>

                <Button asChild size="lg" variant="accent" className="mt-8">
                  <Link href="/become-an-agent">
                    Become a Go Agent
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>

              <dl className="grid grid-cols-2 gap-4 rounded-xl bg-primary-foreground/10 p-6">
                {[
                  { label: 'Verified before assignment', value: 'Every agent' },
                  { label: 'Proof required to close', value: 'Every task' },
                  { label: 'Launch city', value: LAUNCH_CITY.name },
                  { label: 'Paid before work starts', value: 'Always' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-xs text-primary-foreground/70">{stat.label}</dt>
                    <dd className="mt-1 font-display text-lg font-semibold">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing CTA                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t bg-muted/30">
        <div className="container py-16 text-center sm:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            You have something that needs doing. We have someone who can do it.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-pretty">
            Describe the task. We review it, quote it, and put a verified Go Agent on it once you
            approve.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/tasks/new">
                Request a Task
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
