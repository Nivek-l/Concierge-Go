import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Camera, MessageSquare, ShieldAlert } from 'lucide-react'

import { LAUNCH_CITY } from '@/lib/constants'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { WorkflowSteps } from '@/components/marketing/workflow-steps'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Request, quote, pay, track, proof, done. See exactly how a Concierge Go task runs from the moment you describe it.',
  alternates: { canonical: '/how-it-works' },
}

const FAQS = [
  {
    question: 'How much does a task cost?',
    answer:
      'It depends on the task. A person reads your request and sends a quote broken into service fee, transport and task execution fee. You see the full total before you decide, and nothing starts until you accept and pay.',
  },
  {
    question: 'How fast will my task be done?',
    answer:
      'We do not promise a fixed delivery time, because we would rather be honest than fast on paper. Tell us your preferred date and how urgent it is; we confirm what is realistic in the quote.',
  },
  {
    question: 'What if the agent buys something on my behalf?',
    answer:
      'Your Go Agent confirms the item and price with you before paying, and the receipt is attached to your task as proof. Purchase amounts are agreed in the quote so there are no surprises.',
  },
  {
    question: 'What proof do I get?',
    answer:
      'Depending on the task: photos, a short video, a scan of the document, or a receipt. Proof is required before a task can be sent to you for confirmation.',
  },
  {
    question: 'What if something goes wrong?',
    answer:
      'Report a problem from the task page instead of confirming completion. The task is flagged for operations, a person reviews the proof and messages, and we come back to you with a resolution.',
  },
  {
    question: 'Is my personal information shared with the agent?',
    answer:
      'Only what they need to do the task — your name, the contact number for the task, and the location. Your email address is never shown to an agent.',
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <section className="border-b bg-muted/30">
        <div className="container py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              How it works
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Six steps, and you can see all of them
            </h1>
            <p className="mt-5 text-base text-muted-foreground text-pretty sm:text-lg">
              Every Concierge Go task follows the same path. At each point you know what is
              happening, what happens next, what it costs and who is handling it.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container py-14 sm:py-20">
          <WorkflowSteps />
        </div>
      </section>

      {/* Worked example — a real quote breakdown, in naira. */}
      <section className="border-b bg-card">
        <div className="container py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                A real quote
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                You see every naira before you pay
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                No hidden charges and no surge pricing after the fact. If the task turns out to need
                more than we quoted, we come back to you first — we never spend your money without
                asking.
              </p>

              <ul className="mt-6 space-y-3 text-sm">
                {[
                  {
                    icon: MessageSquare,
                    text: 'Message your Go Agent inside the task if anything needs clarifying.',
                  },
                  {
                    icon: Camera,
                    text: 'Proof is attached to the task, and it stays there for your records.',
                  },
                  {
                    icon: ShieldAlert,
                    text: 'Not right? Report a problem instead of confirming, and operations steps in.',
                  },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-muted-foreground text-pretty">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border bg-background p-6 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Example: certificate collection in {LAUNCH_CITY.name}
              </p>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Service fee</dt>
                  <dd className="font-medium tabular-nums">{formatNaira(200000)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Transportation</dt>
                  <dd className="font-medium tabular-nums">{formatNaira(100000)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Task execution fee</dt>
                  <dd className="font-medium tabular-nums">{formatNaira(30000)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
                <span className="font-display text-base font-semibold">Total</span>
                <span className="font-display text-2xl font-bold tabular-nums">
                  {formatNaira(330000)}
                </span>
              </div>

              <p className="mt-4 text-xs text-muted-foreground text-pretty">
                An illustration, not a fixed price. Your quote depends on the task, the distance and
                how urgent it is.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container py-14 sm:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Questions people ask
          </h2>

          <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:gap-x-12">
            {FAQS.map((faq) => (
              <div key={faq.question}>
                <dt className="font-display text-base font-semibold tracking-tight">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-sm text-muted-foreground text-pretty">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-muted/30">
        <div className="container py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to hand something over?
          </h2>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/tasks/new">
                Request a Task
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/services">See what we handle</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
