'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowRight, Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * Homepage task-request preview.
 *
 * The core promise is "describe what you need" — so the very first interaction
 * on the site is that text box, not a service catalogue. What the visitor types
 * is carried into /tasks/new, so nothing they write is thrown away.
 */

const EXAMPLES = [
  {
    label: 'Collect a document',
    text: 'I need someone to collect my certificate from the school registry in Calabar and bring it to me.',
  },
  {
    label: 'Submit an application',
    text: 'Please submit my completed application form at the state secretariat and get a stamped acknowledgement.',
  },
  {
    label: 'Buy and verify an item',
    text: 'Buy a specific phone charger from Watt Market. Send me photos and confirm the price before paying.',
  },
  {
    label: 'Inspect a property',
    text: 'Inspect a two-bedroom flat in Satellite Town before I pay the deposit. I need photos, a short video and your honest assessment.',
  },
  {
    label: 'Handle a business errand',
    text: 'Deliver signed contract documents to my client’s office and collect their stamped copy for me.',
  },
  {
    label: 'Complete a personal task',
    text: 'Pay my electricity bill at the office in person and send me the receipt the same day.',
  },
]

export function TaskRequestPreview() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [activeExample, setActiveExample] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleExample(example: (typeof EXAMPLES)[number]) {
    setValue(example.text)
    setActiveExample(example.label)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const description = value.trim()

    startTransition(() => {
      // Carry the description across so /tasks/new opens pre-filled.
      const query = description ? `?description=${encodeURIComponent(description)}` : ''
      router.push(`/tasks/new${query}`)
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-lift sm:p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" aria-hidden />
        Start here
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <label htmlFor="preview-description" className="font-display text-lg font-semibold tracking-tight">
          What do you need done?
        </label>

        <Textarea
          id="preview-description"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setActiveExample(null)
          }}
          placeholder="Describe what you need Concierge Go to handle. For example: I need someone to collect my certificate from the school and bring it to me."
          className="mt-3 min-h-[120px] resize-none bg-background text-base"
          maxLength={4000}
        />

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Or start from an example
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => handleExample(example)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeExample === example.label
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" className="mt-5 w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Continue with this request
          {!isPending ? <ArrowRight aria-hidden /> : null}
        </Button>

        <p className="mt-3 text-center text-xs text-muted-foreground text-pretty">
          No payment yet. We review your request and send a quote first — you decide from there.
        </p>
      </form>
    </div>
  )
}
