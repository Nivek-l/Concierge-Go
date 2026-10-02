'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MapPin, Star } from 'lucide-react'

import { assignAgentAction, reassignAgentAction } from '@/actions/admin'
import { formatNaira, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import type { AssignmentCandidate } from '@/types/domain'

export function AssignAgentPanel({
  taskId,
  candidates,
  currentAgentId,
  agentPayoutKobo,
}: {
  taskId: string
  candidates: AssignmentCandidate[]
  currentAgentId?: string | null
  agentPayoutKobo?: number
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [isPending, setPending] = useState(false)

  const sorted = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        if (a.coversTaskArea !== b.coversTaskArea) return a.coversTaskArea ? -1 : 1
        if (a.coversTaskCity !== b.coversTaskCity) return a.coversTaskCity ? -1 : 1
        const aFull = a.activeTaskCount >= a.maxActiveTasks
        const bFull = b.activeTaskCount >= b.maxActiveTasks
        if (aFull !== bFull) return aFull ? 1 : -1
        return b.rating - a.rating
      }),
    [candidates],
  )

  async function handleAssign() {
    if (!selected) {
      toast.error('Choose an agent first.')
      return
    }
    if (currentAgentId && reason.trim().length < 5) {
      toast.error('Give a brief reason for the reassignment.')
      return
    }

    setPending(true)
    const formData = new FormData()
    formData.set('taskId', taskId)
    formData.set('agentId', selected)
    if (currentAgentId) formData.set('reason', reason)
    else if (reason.trim()) formData.set('note', reason)

    const result = currentAgentId ? await reassignAgentAction(formData) : await assignAgentAction(formData)
    setPending(false)

    if (result.ok) {
      toast.success(result.message ?? 'Agent assigned.')
      setSelected(null)
      setReason('')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No verified agents are available right now.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="max-h-96 space-y-2 overflow-y-auto">
        {sorted.map((candidate) => {
          const isCurrent = candidate.agentId === currentAgentId
          const isFull = candidate.activeTaskCount >= candidate.maxActiveTasks
          const disabled = isCurrent || (isFull && !candidate.isAvailable)
          const active = selected === candidate.agentId

          return (
            <li key={candidate.agentId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelected(candidate.agentId)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  active && 'border-primary bg-primary-subtle',
                  disabled && 'cursor-not-allowed opacity-50',
                  !active && !disabled && 'hover:border-primary/40',
                )}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={candidate.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-xs">{initials(candidate.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{candidate.fullName}</p>
                    {isCurrent ? <Badge variant="progress">Current</Badge> : null}
                    {candidate.coversTaskArea ? <Badge variant="success">In area</Badge> : null}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-warning text-warning" aria-hidden />
                      {candidate.rating.toFixed(1)} ({candidate.ratingCount})
                    </span>
                    <span>{candidate.completedTasks} completed</span>
                    <span>
                      {candidate.activeTaskCount}/{candidate.maxActiveTasks} active
                    </span>
                  </p>
                  {candidate.serviceAreas.length > 0 ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                      {candidate.serviceAreas.join(', ')}
                    </p>
                  ) : null}
                </div>
                {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            </li>
          )
        })}
      </ul>

      {agentPayoutKobo ? (
        <p className="text-xs text-muted-foreground">
          Agent payout for this task: <strong>{formatNaira(agentPayoutKobo)}</strong>
        </p>
      ) : null}

      {currentAgentId ? (
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for reassignment"
          rows={2}
        />
      ) : null}

      <Button className="w-full" loading={isPending} disabled={!selected} onClick={handleAssign}>
        {currentAgentId ? 'Reassign agent' : 'Assign agent'}
      </Button>
    </div>
  )
}
