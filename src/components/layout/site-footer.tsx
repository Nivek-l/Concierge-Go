import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'

import { APP_TAGLINE, LAUNCH_CITY } from '@/lib/constants'
import { publicEnv } from '@/lib/env'
import { formatPhone } from '@/lib/format'
import { Logo } from '@/components/shared/logo'

const FOOTER_SECTIONS = [
  {
    title: 'Concierge Go',
    links: [
      { href: '/services', label: 'What we handle' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/tasks/new', label: 'Request a task' },
    ],
  },
  {
    title: 'Go Agents',
    links: [
      { href: '/become-an-agent', label: 'Become a Go Agent' },
      { href: '/sign-in', label: 'Agent sign in' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/sign-in', label: 'Sign in' },
      { href: '/sign-up', label: 'Create an account' },
      { href: '/forgot-password', label: 'Reset password' },
    ],
  },
]

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground text-pretty">
              {APP_TAGLINE} Real tasks, handled by verified local agents, with proof you can see.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {LAUNCH_CITY.label}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                <a href={`tel:${publicEnv.supportPhone}`} className="hover:text-foreground">
                  {formatPhone(publicEnv.supportPhone)}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <a href={`mailto:${publicEnv.supportEmail}`} className="hover:text-foreground">
                  {publicEnv.supportEmail}
                </a>
              </li>
            </ul>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Concierge Go. Starting in {LAUNCH_CITY.name}, expanding across Nigeria.
          </p>
          <p>
            Concierge Go handles legitimate local tasks only. We do not provide legal, financial or
            medical advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
