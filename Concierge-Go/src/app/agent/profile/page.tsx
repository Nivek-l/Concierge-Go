import type { Metadata } from 'next'
import { Star } from 'lucide-react'

import { requireAgent } from '@/lib/auth'
import { getAgentServiceAreas } from '@/database/agents'
import { getAgentBankAccount } from '@/database/payouts'
import { getPayoutMode } from '@/lib/env'
import { listNigerianBanks } from '@/services/payouts/paystack'
import { getCities } from '@/database/reference'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AvatarUploader } from '@/components/profile/avatar-uploader'
import { AgentProfileForm } from '@/components/agent/agent-profile-form'
import { AgentBankAccountForm } from '@/components/agent/agent-bank-account-form'

export const metadata: Metadata = {
  title: 'Agent profile',
  robots: { index: false, follow: false },
}

const VERIFICATION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

export default async function AgentProfilePage() {
  const user = await requireAgent()
  const [areas, cities, bankAccount, banks] = await Promise.all([
    getAgentServiceAreas(user.agent.id),
    getCities(),
    getAgentBankAccount(user.agent.id),
    listNigerianBanks(),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Agent profile
        </h1>
        <Badge variant={VERIFICATION_TONE[user.agent.verification_status]}>
          {user.agent.verification_status}
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <AvatarUploader
            profileId={user.id}
            fullName={user.profile.full_name}
            avatarUrl={user.profile.avatar_url}
          />
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" aria-hidden />
              {user.agent.rating.toFixed(1)} ({user.agent.rating_count})
            </span>
            <span>{user.agent.completed_tasks} completed</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentProfileForm
            agent={user.agent}
            cities={cities}
            serviceAreas={areas.map((area) => area.area_name)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout bank account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Task earnings are paid only to this verified Nigerian bank account. Never share your PIN or OTP.
          </p>
          <AgentBankAccountForm
            account={bankAccount}
            banks={banks}
            payoutMode={getPayoutMode()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
