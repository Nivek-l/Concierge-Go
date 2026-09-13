import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'

import { CURRENCY } from './constants'

/* -------------------------------------------------------------------------- */
/* Money — stored as kobo everywhere, displayed as naira                      */
/* -------------------------------------------------------------------------- */

export function koboToNaira(kobo: number) {
  return kobo / 100
}

export function nairaToKobo(naira: number) {
  return Math.round(naira * 100)
}

/**
 * ₦3,300 — whole naira by default because Nigerian pricing is quoted in whole
 * naira. Pass `showKobo` when a fractional amount genuinely matters.
 */
export function formatNaira(kobo: number | null | undefined, options?: { showKobo?: boolean }) {
  const amount = koboToNaira(kobo ?? 0)
  const fractionDigits = options?.showKobo || amount % 1 !== 0 ? 2 : 0
  return `${CURRENCY.symbol}${amount.toLocaleString('en-NG', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

/** Compact form for dashboard tiles: ₦1.2m, ₦840k. */
export function formatNairaCompact(kobo: number | null | undefined) {
  const amount = koboToNaira(kobo ?? 0)
  if (amount >= 1_000_000) return `${CURRENCY.symbol}${(amount / 1_000_000).toFixed(1)}m`
  if (amount >= 10_000) return `${CURRENCY.symbol}${Math.round(amount / 1000)}k`
  return formatNaira(kobo)
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  const date = typeof value === 'string' ? parseISO(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  if (!date) return fallback
  return format(date, 'd MMM yyyy')
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  if (!date) return fallback
  return format(date, "d MMM yyyy 'at' h:mma")
}

export function formatTimeOnly(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  if (!date) return fallback
  return format(date, 'h:mma')
}

/** "2 hours ago", plus friendly words for the days around today. */
export function formatRelative(value: string | Date | null | undefined, fallback = '—') {
  const date = toDate(value)
  if (!date) return fallback
  const diff = Math.abs(Date.now() - date.getTime())
  if (diff < 60_000) return 'just now'
  return `${formatDistanceToNowStrict(date)} ago`
}

export function formatFriendlyDate(value: string | Date | null | undefined, fallback = 'Flexible') {
  const date = toDate(value)
  if (!date) return fallback
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE d MMM')
}

/** For <input type="date"> defaults and min values. */
export function toDateInputValue(value: Date = new Date()) {
  return format(value, 'yyyy-MM-dd')
}

/* -------------------------------------------------------------------------- */
/* Nigerian phone numbers                                                     */
/* -------------------------------------------------------------------------- */

const NG_LOCAL = /^0[789][01]\d{8}$/
const NG_E164 = /^\+234[789][01]\d{8}$/

export function isValidNigerianPhone(input: string) {
  const cleaned = input.replace(/[\s()-]/g, '')
  return NG_LOCAL.test(cleaned) || NG_E164.test(cleaned) || /^234[789][01]\d{8}$/.test(cleaned)
}

/** Normalises 0803…, 234803…, +234803… to a single stored form: +234803… */
export function normalizeNigerianPhone(input: string) {
  const cleaned = input.replace(/[\s()-]/g, '')
  if (cleaned.startsWith('+234')) return cleaned
  if (cleaned.startsWith('234')) return `+${cleaned}`
  if (cleaned.startsWith('0')) return `+234${cleaned.slice(1)}`
  return cleaned
}

/** Displays as 0803 123 4567 — the way a Nigerian number is read aloud. */
export function formatPhone(input: string | null | undefined, fallback = '—') {
  if (!input) return fallback
  const cleaned = input.replace(/[\s()-]/g, '')
  const local = cleaned.startsWith('+234')
    ? `0${cleaned.slice(4)}`
    : cleaned.startsWith('234')
      ? `0${cleaned.slice(3)}`
      : cleaned
  if (!/^0\d{10}$/.test(local)) return input
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}

/* -------------------------------------------------------------------------- */
/* Misc display helpers                                                       */
/* -------------------------------------------------------------------------- */

export function initials(name: string | null | undefined) {
  if (!name) return 'CG'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'CG'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)}${units[unit]}`
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function firstName(fullName: string | null | undefined) {
  if (!fullName) return 'there'
  const [first] = fullName.trim().split(/\s+/)
  return first || 'there'
}

export function formatRating(rating: number, count: number) {
  if (!count) return 'No ratings yet'
  return `${Number(rating).toFixed(1)} (${count} ${pluralize(count, 'rating')})`
}
