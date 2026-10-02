import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, CalendarClock, MapPin, Wallet } from 'lucide-react'

import { LAUNCH_CITY } from '@/lib/constants'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Become a Go Agent',
  description:
    'Earn by handling real tasks in Calabar. Get verified, pick tasks that fit your day, and get paid per completed task.',
  alternates: { canonical: '/become-an-agent' },
}

const STEPS = [
  {
    title: 'Create your agent account',
    body: 'Name, phone number, the areas of Calabar you cover and how you get around.',
  },
  {
    title: 'Submit for verification',
    body: 'A short form about your availability, experience and a referee. Operations reviews it — usually within a couple of days.',
  },
  {
    title: 'Start taking tasks',
    body: 'Once verified, the job board opens. Every task shows the payout before you accept it.',
  },
]

const BENEFITS = [
  {
    icon: Wallet,
    title: 'Paid work only',
    body: 'A task only reaches the board after the customer has paid. You never chase money.',
  },
  {
    icon: CalendarClock,
    title: 'Work on your schedule',
    body: 'Take what fits your day. Mark yourself unavailable when you are busy.',
  },
  {
    icon: MapPin,
    title: 'Tasks near you',
    body: 'You only see tasks in the areas you told us you cover.',
  },
  {
    icon: BadgeCheck,
    title: 'Build a rating',
    body: 'Complete tasks well and your rating and completed count get you more work.',
  },
]

export default function BecomeAnAgentPage() {
  return (
    <>
      <section className="border-b bg-muted/30">
        <div className="container py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                For Go Agents
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
                Know {LAUNCH_CITY.name}? Get paid for it.
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
                Concierge Go customers need someone reliable on the ground — to collect a document,
                inspect a flat, buy something and check it properly. If that is you, become a
                verified Go Agent.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/sign-up/agent">
                    Apply to be a Go Agent
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/sign-in">Already an agent? Sign in</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-lift sm:p-8">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                What we ask of you
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  'Turn up when you say you will, and tell the customer if plans change.',
                  'Submit real proof — photos, receipts, documents — for every task.',
                  'Never spend a customer’s money without confirming with them first.',
                  'Keep customer details private. What you see on a task stays on the task.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-pretty">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-5 border-t pt-4 text-xs text-muted-foreground text-pretty">
                We ask about how you work and who can vouch for you. We do not ask for your BVN,
                bank details or ID documents to sign up.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container py-14 sm:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Getting started
          </h2>

          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-card p-5 shadow-soft">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="container py-14 sm:py-20">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-subtle">
                  <benefit.icon className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold tracking-tight">
                  {benefit.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{benefit.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30">
        <div className="container py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to start?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground text-pretty">
            Create your agent account and submit for verification. You will hear from operations
            once it has been reviewed.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/sign-up/agent">
              Apply to be a Go Agent
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
