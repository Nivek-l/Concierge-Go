import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Clock, ShieldAlert } from 'lucide-react'

import { requireAgent } from '@/lib/auth'
import { getLatestVerification } from '@/database/agents'
import { formatFriendlyDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VerificationForm } from '@/components/agent/verification-form'

export const metadata: Metadata = {
  title: 'Agent verification',
  robots: { index: false, follow: false },
}

export default async function AgentVerificationPage() {
  const user = await requireAgent()
  const latest = await getLatestVerification(user.agent.id)

  if (user.agent.verification_status === 'verified') {
    console.info('[agent-route]', {
      pathname: '/agent/verification',
      authLoading: false,
      userId: user.id,
      agentProfileLoading: false,
      verificationStatus: user.agent.verification_status,
      redirectDestination: '/agent',
    })
    redirect('/agent')
  }

  console.info('[agent-route]', {
    pathname: '/agent/verification',
    authLoading: false,
    userId: user.id,
    agentProfileLoading: false,
    verificationStatus: user.agent.verification_status,
    redirectDestination: null,
  })

  if (latest?.status === 'pending') {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-10 text-center">
          <Clock className="h-8 w-8 text-warning" aria-hidden />
          <h1 className="mt-4 font-display text-xl font-bold tracking-tight">
            Your verification is under review
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted {formatFriendlyDate(latest.created_at)}. Operations will update you soon.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Go Agent verification
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          Tell us how you work. Concierge Go operations reviews this before you can accept tasks.
        </p>
      </div>

      {latest?.status === 'rejected' ? (
        <Card className="border-destructive/30 bg-destructive-subtle/40">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />
            <CardTitle className="text-sm">Your last submission needs another look</CardTitle>
          </CardHeader>
          {latest.review_notes ? (
            <CardContent className="pt-0 text-sm text-muted-foreground text-pretty">
              {latest.review_notes}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {user.agent.verification_status === 'suspended' ? (
        <Card className="border-destructive/30 bg-destructive-subtle/40">
          <CardContent className="flex items-center gap-2 pt-5 text-sm">
            <Badge variant="danger">Suspended</Badge>
            <span className="text-muted-foreground">
              Contact Concierge Go operations before resubmitting.
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <VerificationForm defaultTransportMode={user.agent.transport_mode} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
