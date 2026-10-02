'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function PortalSearch({ basePath = '/tasks', placeholder = 'Search tasks…' }: { basePath?: string; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  function submit(event: FormEvent) {
    event.preventDefault()
    const q = query.trim()
    router.push(q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath)
  }
  return <form onSubmit={submit} role="search" className="relative w-full max-w-md">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-h-11 w-full rounded-xl border bg-muted/45 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-ring focus:ring-offset-1" />
  </form>
}
