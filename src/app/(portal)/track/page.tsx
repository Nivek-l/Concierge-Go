import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPinned } from 'lucide-react'
import { requireCustomer } from '@/lib/auth'
import { getCustomerDashboard } from '@/database/tasks'
import { TASK_STATUS_META } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TaskStatusBadge } from '@/components/shared/status-badge'

export const metadata: Metadata = { title: 'Track Tasks', robots: { index: false, follow: false } }
export default async function TrackPage() {
 const user = await requireCustomer(); const data = await getCustomerDashboard(user.id)
 const trackable = data.activeTasks.filter(t => ['assigned','en_route','arrived','in_progress'].includes(t.status))
 return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-semibold text-primary">Live journeys</p><h1 className="mt-1 font-display text-3xl font-bold">Track your tasks</h1><p className="mt-2 text-sm text-muted-foreground">See the current stage first. Open a task for its live map when your Go Agent is sharing location.</p></div>{trackable.length === 0 ? <Card><CardContent className="p-6"><EmptyState icon={MapPinned} title="Nothing to track right now" description="Assigned and in-progress tasks will appear here automatically." action={{label:'View my tasks',href:'/tasks'}} /></CardContent></Card> : <div className="grid gap-4">{trackable.map(task => { const meta=TASK_STATUS_META[task.status]; return <Link key={task.id} href={`/tasks/${task.id}`}><Card className="transition hover:border-primary/40 hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.reference} · {task.location_area ?? task.city_name ?? 'Task location'}</p></div><TaskStatusBadge status={task.status} /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${meta.progress}%`}} /></div><div className="mt-3 flex items-center justify-between text-xs"><span className="font-medium text-muted-foreground">{meta.label}</span><span className="flex items-center gap-1 font-semibold text-primary">Open tracking <ArrowRight className="h-3.5 w-3.5" /></span></div></CardContent></Card></Link>})}</div>}</div>
}
