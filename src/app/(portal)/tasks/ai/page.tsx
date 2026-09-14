import type { Metadata } from 'next'

import { requireCustomer } from '@/lib/auth'
import { AiTaskChat } from '@/components/tasks/ai-task-chat'

export const metadata: Metadata = {
  title: 'Request with AI',
  robots: { index: false, follow: false },
}

export default async function AiTaskPage() {
  await requireCustomer('/tasks/ai')

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Request with AI
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">
          Explain the errand like you would to a person. Go Assistant will follow the conversation,
          ask for missing details, and prepare the task form for your review.
        </p>
      </div>
      <AiTaskChat />
    </div>
  )
}
