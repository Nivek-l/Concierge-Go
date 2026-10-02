import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireCustomer } from '@/lib/auth'
import { getTaskDetail } from '@/database/tasks'
import { DisputeForm } from '@/components/tasks/dispute-form'

export const metadata: Metadata = {
  title: 'Report a problem',
  robots: { index: false, follow: false },
}

export default async function TaskDisputePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireCustomer()
  const detail = await getTaskDetail(id)

  if (!detail || detail.task.customer_id !== user.id) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/tasks/${id}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to task
      </Link>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Report a problem
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {detail.task.title} · {detail.task.reference}
      </p>
      <div className="mt-6">
        <DisputeForm taskId={id} />
      </div>
    </div>
  )
}
