import type { AssignmentCandidate } from '@/types/domain'
import type { TaskRow } from '@/types/database'

/**
 * Agent matching.
 *
 * The MVP assigns by hand: operations sees a ranked, explained list and picks.
 * Ranking lives here rather than in the page so that automated matching can be
 * switched on later by calling `rankCandidates` and taking the top result —
 * the scoring, the eligibility rules and the explanations are already the ones
 * a human has been sanity-checking in production.
 */

export interface CandidateScore {
  candidate: AssignmentCandidate
  score: number
  /** Plain-English reasons, shown next to the agent in the assignment panel. */
  reasons: string[]
  /** Hard blocks. A candidate with any of these cannot be assigned. */
  blockers: string[]
}

export interface RankContext {
  task: Pick<TaskRow, 'urgency' | 'location_area' | 'city_id' | 'requires_proof'>
}

export function rankCandidates(
  candidates: AssignmentCandidate[],
  context: RankContext,
): CandidateScore[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, context))
    .sort((a, b) => {
      // Blocked agents always sort last, however good their numbers are.
      if (a.blockers.length !== b.blockers.length) return a.blockers.length - b.blockers.length
      return b.score - a.score
    })
}

function scoreCandidate(candidate: AssignmentCandidate, context: RankContext): CandidateScore {
  const reasons: string[] = []
  const blockers: string[] = []
  let score = 0

  if (!candidate.coversTaskCity) {
    blockers.push('Does not cover this city')
  }

  if (candidate.activeTaskCount >= candidate.maxActiveTasks) {
    blockers.push(`At capacity (${candidate.activeTaskCount}/${candidate.maxActiveTasks} tasks)`)
  }

  if (!candidate.isAvailable) {
    blockers.push('Marked themselves unavailable')
  }

  // --- Location -------------------------------------------------------------
  if (candidate.coversTaskArea) {
    score += 40
    reasons.push('Works in this exact area')
  } else if (candidate.coversTaskCity) {
    score += 20
    reasons.push('Covers this city')
  }

  // --- Workload -------------------------------------------------------------
  const headroom = candidate.maxActiveTasks - candidate.activeTaskCount
  if (headroom >= 2) {
    score += 20
    reasons.push(
      candidate.activeTaskCount === 0
        ? 'No active tasks right now'
        : `${headroom} slots free`,
    )
  } else if (headroom === 1) {
    score += 8
    reasons.push('One slot free')
  }

  // --- Track record ---------------------------------------------------------
  if (candidate.ratingCount >= 3) {
    score += Math.round(candidate.rating * 6)
    if (candidate.rating >= 4.5) reasons.push(`Rated ${candidate.rating.toFixed(1)} by customers`)
  } else if (candidate.ratingCount > 0) {
    score += Math.round(candidate.rating * 3)
  } else {
    // Not a penalty — new agents need a first task to build a record.
    reasons.push('New agent, no ratings yet')
  }

  if (candidate.completedTasks >= 20) {
    score += 12
    reasons.push(`${candidate.completedTasks} tasks completed`)
  } else if (candidate.completedTasks >= 5) {
    score += 6
    reasons.push(`${candidate.completedTasks} tasks completed`)
  }

  // --- Urgency --------------------------------------------------------------
  if (context.task.urgency === 'urgent') {
    if (candidate.activeTaskCount === 0) {
      score += 15
      reasons.push('Free now — good fit for an urgent task')
    }
    if (candidate.completedTasks < 3) {
      score -= 10
      reasons.push('Limited history for an urgent task')
    }
  }

  return { candidate, score, reasons, blockers }
}

/**
 * What automated assignment will call. Returns null when no candidate is
 * clearly good enough, which keeps a human in the loop for the hard cases.
 */
export function autoSelectAgent(
  candidates: AssignmentCandidate[],
  context: RankContext,
  options?: { minimumScore?: number },
): CandidateScore | null {
  const ranked = rankCandidates(candidates, context).filter((entry) => entry.blockers.length === 0)
  const best = ranked[0]
  if (!best) return null
  if (best.score < (options?.minimumScore ?? 45)) return null
  return best
}
