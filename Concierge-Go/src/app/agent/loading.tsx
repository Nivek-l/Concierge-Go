import { Skeleton, SkeletonList, SkeletonStats } from '@/components/ui/skeleton'

export default function AgentLoading() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-64" /></div>
      <SkeletonStats />
      <SkeletonList count={3} />
      <span className="sr-only">Loading agent workspace</span>
    </div>
  )
}
