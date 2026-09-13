import Link from 'next/link'
import {
  Briefcase,
  FileText,
  Footprints,
  Home,
  PartyPopper,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { TaskCategoryRow } from '@/types/database'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  FileText,
  ShoppingBag,
  Footprints,
  Briefcase,
  Home,
  PartyPopper,
  Sparkles,
}

interface CategoryGridProps {
  categories: TaskCategoryRow[]
  /** Link each card into the request form with the category preselected. */
  linkToRequest?: boolean
  showExamples?: boolean
  className?: string
}

export function CategoryGrid({
  categories,
  linkToRequest = true,
  showExamples = true,
  className,
}: CategoryGridProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category.icon] ?? Sparkles
        const examples = showExamples ? category.examples.slice(0, 3) : []

        const inner = (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold tracking-tight">
                  {category.name}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{category.tagline}</p>
              </div>
            </div>

            {examples.length > 0 ? (
              <ul className="mt-4 space-y-1.5">
                {examples.map((example) => (
                  <li
                    key={example}
                    className="flex items-start gap-2 text-sm text-muted-foreground text-pretty"
                  >
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                    {example}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )

        if (!linkToRequest) {
          return (
            <div key={category.id} className="rounded-xl border bg-card p-5 shadow-soft">
              {inner}
            </div>
          )
        }

        return (
          <Link
            key={category.id}
            href={`/tasks/new?category=${category.slug}`}
            className="group rounded-xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {inner}
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Request this
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
