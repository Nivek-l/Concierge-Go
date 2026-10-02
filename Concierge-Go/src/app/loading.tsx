import { Skeleton, SkeletonList, SkeletonStats } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container space-y-8 px-4 py-8" role="status" aria-live="polite" aria-label="Loading page">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <SkeletonStats />
      <SkeletonList />
      <span className="sr-only">Loading page content</span>
    </div>
  )
}
