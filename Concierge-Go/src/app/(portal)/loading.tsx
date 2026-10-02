import { Skeleton, SkeletonList, SkeletonStats } from '@/components/ui/skeleton'

export default function PortalLoading() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <div className="space-y-2"><Skeleton className="h-8 w-52" /><Skeleton className="h-4 w-72 max-w-full" /></div>
      <SkeletonStats count={3} />
      <SkeletonList count={4} />
      <span className="sr-only">Loading your Concierge Go account</span>
    </div>
  )
}
