import { Skeleton, SkeletonList, SkeletonStats } from '@/components/ui/skeleton'

export default function AdminLoading() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80 max-w-full" /></div>
      <SkeletonStats count={8} />
      <SkeletonList count={3} />
      <span className="sr-only">Loading operations data</span>
    </div>
  )
}
