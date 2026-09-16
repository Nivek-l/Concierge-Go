import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList, Search } from 'lucide-react'

import { requireAdmin } from '@/lib/auth'
import { getAdminTasks } from '@/database/admin'
import { getCategories } from '@/database/reference'
import { formatFriendlyDate, formatNaira } from '@/lib/format'
import { TASK_URGENCIES } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge, UrgencyBadge } from '@/components/shared/status-badge'

export const metadata: Metadata = {
  title: 'Manage tasks',
  robots: { index: false, follow: false },
}

const QUICK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'active', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
] as const

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; urgency?: string; q?: string; page?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const status = params.status ?? 'all'
  const category = params.category ?? 'all'
  const urgency = params.urgency ?? 'all'
  const search = params.q ?? ''
  const page = Number(params.page ?? '1') || 1

  const [{ tasks, total, totalPages }, categories] = await Promise.all([
    getAdminTasks({ status, category, urgency, search, page }),
    getCategories(),
  ])

  function buildHref(overrides: Record<string, string>) {
    const next = new URLSearchParams({ status, category, urgency, q: search, ...overrides })
    for (const [key, value] of Array.from(next.entries())) {
      if (!value || value === 'all') next.delete(key)
    }
    const qs = next.toString()
    return qs ? `/admin/tasks?${qs}` : '/admin/tasks'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Manage tasks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} task{total === 1 ? '' : 's'}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => (
          <Link key={filter.value} href={buildHref({ status: filter.value, page: '' })}>
            <Badge variant={status === filter.value ? 'progress' : 'neutral'} className="cursor-pointer px-3 py-1.5">
              {filter.label}
            </Badge>
          </Link>
        ))}
      </div>

      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" action="/admin/tasks">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={search} placeholder="Search reference or title" className="pl-9" />
        </div>
        <input type="hidden" name="status" value={status} />
        <Select name="category" defaultValue={category}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="urgency" defaultValue={urgency}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All urgency</SelectItem>
            {TASK_URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit">Filter</Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No tasks match these filters" description="Try a different status or search term." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/admin/tasks/${task.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{task.title}</p>
                        <UrgencyBadge urgency={task.urgency} />
                        {task.has_open_dispute ? <Badge variant="danger">Disputed</Badge> : null}
                      </div>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">
                        {task.reference} · {task.customer_name} · {task.category_name}
                        {task.agent_name ? ` · ${task.agent_name}` : ''} ·{' '}
                        {formatFriendlyDate(task.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      <TaskStatusBadge status={task.status} perspective="admin" />
                      {task.total_kobo ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatNaira(task.total_kobo)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={buildHref({ page: String(p) })}>
              <Badge variant={p === page ? 'progress' : 'neutral'} className="cursor-pointer px-3 py-1">
                {p}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
