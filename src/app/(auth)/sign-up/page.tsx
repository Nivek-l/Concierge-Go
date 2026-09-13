import type { Metadata } from 'next'

import { getLiveCities } from '@/database/reference'
import { SignUpForm } from '@/components/auth/sign-up-form'

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Sign up for Concierge Go to request tasks in Calabar.',
  robots: { index: false, follow: false },
}

export default async function SignUpPage() {
  const cities = await getLiveCities()
  return <SignUpForm cities={cities} />
}
