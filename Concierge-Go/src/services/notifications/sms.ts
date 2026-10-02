import 'server-only'

/**
 * SMS channel — and the seam where WhatsApp will sit.
 *
 * Nigerian customers reach for SMS and WhatsApp before email, so this is the
 * channel most likely to be connected first. Set SMS_PROVIDER + SMS_API_KEY +
 * SMS_SENDER_ID and implement a branch (Termii, Africa's Talking, Twilio).
 */

export interface SmsMessage {
  to: string
  body: string
}

export interface SmsResult {
  delivered: boolean
  provider: string
  reason?: string
}

export function isSmsConfigured() {
  return Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY)
}

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER?.toLowerCase()

  if (!isSmsConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[concierge-go][sms:noop]', { to: message.to })
    }
    return { delivered: false, provider: 'none', reason: 'not_configured' }
  }

  switch (provider) {
    case 'termii': {
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.to,
          from: process.env.SMS_SENDER_ID ?? 'ConciergeGo',
          sms: message.body,
          type: 'plain',
          channel: 'generic',
          api_key: process.env.SMS_API_KEY,
        }),
      })
      return { delivered: response.ok, provider: 'termii' }
    }

    default:
      return { delivered: false, provider: provider ?? 'unknown', reason: 'unsupported_provider' }
  }
}
