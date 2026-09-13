import Link from 'next/link'

import { LAUNCH_CITY } from '@/lib/constants'
import { Logo } from '@/components/shared/logo'

/**
 * Auth shell. A single column on mobile; a quiet brand panel appears alongside
 * on large screens rather than pushing the form off-centre.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="flex flex-1 flex-col">
        <header className="container flex h-16 shrink-0 items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-5 py-10 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>

      <aside className="relative hidden w-[42%] shrink-0 overflow-hidden bg-primary text-primary-foreground lg:block">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/70">
              Concierge Go
            </p>
            <p className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight">
              You ask.
              <br />
              We handle it.
            </p>
            <p className="mt-5 max-w-sm text-primary-foreground/80 text-pretty">
              Real tasks in {LAUNCH_CITY.label}, handled by verified local agents — with a
              transparent quote before you pay and proof before it closes.
            </p>
          </div>

          <ol className="space-y-4 text-sm">
            {[
              ['Request', 'Describe what you need in your own words.'],
              ['Quote', 'A person reviews it and sends a full breakdown.'],
              ['Proof', 'Photos, receipts or documents attached to your task.'],
            ].map(([label, body], index) => (
              <li key={label} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xs font-bold">
                  {index + 1}
                </span>
                <span>
                  <span className="font-semibold">{label}.</span>{' '}
                  <span className="text-primary-foreground/75">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  )
}
