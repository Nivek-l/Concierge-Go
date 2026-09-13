'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star } from 'lucide-react'

import { confirmCompletionAction } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'

export function ProofReviewPanel({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isPending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    if (rating > 0) formData.set('rating', String(rating))
    if (comment.trim()) formData.set('comment', comment.trim())

    const result = await confirmCompletionAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Thank you.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Card className="border-success/30 bg-success-subtle/40">
      <CardHeader>
        <CardTitle>Review the proof below</CardTitle>
        <p className="text-sm text-muted-foreground">
          If everything looks right, confirm completion. If something is wrong, let us know.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Rate your Go Agent (optional)</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value === rating ? 0 : value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
              >
                <Star
                  className={cn(
                    'h-6 w-6 transition-colors',
                    value <= rating ? 'fill-warning text-warning' : 'text-muted-foreground',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {rating > 0 ? (
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Anything you'd like to add about the agent (optional)"
            rows={2}
          />
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" loading={isPending} onClick={confirm}>
            Confirm completion
          </Button>
          <Button asChild variant="outline" className="flex-1" disabled={isPending}>
            <Link href={`/tasks/${taskId}/dispute`}>Report a problem</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
