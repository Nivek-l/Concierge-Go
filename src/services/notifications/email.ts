import 'server-only'

import { getAppUrl } from '@/lib/env'

/**
 * Email channel.
 *
 * Unconfigured by default: the platform is fully usable with in-app
 * notifications alone. Set EMAIL_PROVIDER + EMAIL_API_KEY + EMAIL_FROM and
 * implement the provider branch below (Resend, Postmark, SendGrid, …) — no
 * caller changes required.
 */

export interface EmailMessage {
  to: string
  subject: string
  body: string
  link?: string | null
}

export interface EmailResult {
  delivered: boolean
  provider: string
  reason?: string
}

export function isEmailConfigured() {
  return Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM)
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase()

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[concierge-go][email:noop]', {
        to: message.to,
        subject: message.subject,
      })
    }
    return { delivered: false, provider: 'none', reason: 'not_configured' }
  }

  const linkLine = message.link ? `\n\n${getAppUrl()}${message.link}` : ''

  switch (provider) {
    case 'resend': {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: `${message.body}${linkLine}`,
        }),
      })
      return { delivered: response.ok, provider: 'resend' }
    }

    default:
      return { delivered: false, provider: provider ?? 'unknown', reason: 'unsupported_provider' }
  }
}
