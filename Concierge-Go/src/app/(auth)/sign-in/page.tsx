import type { Metadata } from 'next'

import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Concierge Go account to track your tasks.',
  robots: { index: false, follow: false },
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  // Only accept an internal path — never redirect to an external URL.
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : undefined

  return <SignInForm next={next} />
}
