import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Small helper for building deterministic list keys / storage paths. */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function truncate(value: string, max = 140) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
