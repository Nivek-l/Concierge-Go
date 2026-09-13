import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/lib/utils'

/**
 * The brand mark: a running figure carrying a bag toward a pin, drawn from
 * the official brand guide (rendered once as a trimmed, transparent PNG at
 * public/brand/icon-mark.png). The wordmark is set in Montserrat,
 * "Concierge" in navy and "Go" in orange, matching the brand board's
 * horizontal lockup.
 */
export function Logo({
  className,
  href = '/',
  showWordmark = true,
  showTagline = false,
  size = 'default',
}: {
  className?: string
  href?: string | null
  showWordmark?: boolean
  showTagline?: boolean
  size?: 'sm' | 'default' | 'lg'
}) {
  const sizes = {
    sm: { iconH: 24, text: 'text-base' },
    default: { iconH: 32, text: 'text-xl' },
    lg: { iconH: 44, text: 'text-3xl' },
  }[size]

  // The source art is ~1.92:1 (width:height).
  const iconW = Math.round(sizes.iconH * 1.92)

  const content = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/brand/icon-mark.png"
        alt=""
        width={iconW}
        height={sizes.iconH}
        priority
        unoptimized
        className="shrink-0"
        style={{ height: sizes.iconH, width: 'auto' }}
      />
      {showWordmark ? (
        <span className="inline-flex flex-col leading-none">
          <span className={cn('font-display font-extrabold tracking-tight', sizes.text)}>
            <span className="text-brand-navy">Concierge</span>{' '}
            <span className="text-brand-orange">Go</span>
          </span>
          {showTagline ? (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-navy/80">
              You ask. We handle it.
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )

  if (!href) return content

  return (
    <Link
      href={href}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  )
}
