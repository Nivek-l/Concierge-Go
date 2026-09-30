import type { Metadata } from 'next'
import Link from 'next/link'
import { Bot, ChevronLeft, FileText, Sparkles } from 'lucide-react'
import { requireCustomer } from '@/lib/auth'
import { getCategories, getLiveCities } from '@/database/reference'
import { NewTaskForm } from '@/components/tasks/new-task-form'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Request a Task', robots: { index: false, follow: false } }
export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ mode?: string; source?: string; category?: string }> }) {
  const user = await requireCustomer(); const params = await searchParams
  const showForm = params.mode === 'manual' || params.source === 'ai'
  if (!showForm) return <div className="mx-auto max-w-3xl space-y-7">
    <div><p className="text-sm font-semibold text-primary">New task</p><h1 className="mt-1 font-display text-3xl font-bold">How would you like to start?</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Use Concierge AI to turn a conversation into a request, or complete the familiar form yourself. Both create the same kind of task.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/tasks/ai" className="group"><Card className="h-full border-primary/20 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"><CardContent className="p-6"><span className="inline-flex rounded-2xl bg-primary-subtle p-3 text-primary"><Bot className="h-6 w-6" /></span><div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5" />Recommended</div><h2 className="mt-2 text-xl font-bold">Describe it to Concierge AI</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Chat naturally about what you need. AI will structure the details, then you review the request before submitting.</p></CardContent></Card></Link>
      <Link href="/tasks/new?mode=manual" className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"><CardContent className="p-6"><span className="inline-flex rounded-2xl bg-muted p-3"><FileText className="h-6 w-6" /></span><h2 className="mt-12 text-xl font-bold">Fill it in myself</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the complete request form with location, destination, timing, urgency, budget, instructions and attachments.</p></CardContent></Card></Link>
    </div>
  </div>
  const [categories, cities] = await Promise.all([getCategories(), getLiveCities()])
  const requestedCategory = categories.some((category) => category.slug === params.category)
    ? params.category
    : undefined
  return <div className="mx-auto max-w-2xl"><Link href="/tasks/new" className="mb-5 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" aria-hidden />Choose another method</Link><div className="mb-7"><p className="text-sm font-semibold text-primary">{params.source === 'ai' ? 'AI-assisted request' : 'Manual request'}</p><h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{params.source === 'ai' ? 'Review your request' : 'Request a Task'}</h1><p className="mt-1.5 text-sm text-muted-foreground">Review every detail before submitting. Concierge Go will send a transparent quote before anything is scheduled.</p></div><NewTaskForm categories={categories} cities={cities} defaultPhone={user.profile.phone} initialCategorySlug={requestedCategory} /></div>
}
