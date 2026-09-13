import type { Metadata } from 'next'

import { getLiveCities } from '@/database/reference'
import { AgentSignUpForm } from '@/components/auth/agent-sign-up-form'

export const metadata: Metadata = {
  title: 'Become a Go Agent',
  description: 'Apply to become a verified Concierge Go Agent in Calabar.',
  robots: { index: false, follow: false },
}

export default async function AgentSignUpPage() {
  const cities = await getLiveCities()
  return <AgentSignUpForm cities={cities} />
}
