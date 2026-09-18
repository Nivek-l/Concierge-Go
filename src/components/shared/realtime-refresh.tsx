'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

const TABLES = [
  'tasks',
  'task_quotes',
  'payments',
  'task_assignments',
  'task_proofs',
  'task_messages',
  'notifications',
  'disputes',
  'agent_payouts',
] as const

/** Keeps server-rendered portal data current without a manual page refresh. */
export function RealtimeRefresh({ profileId }: { profileId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 250)
    }

    let channel = supabase.channel(`portal-updates:${profileId}`)
    for (const table of TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        refresh,
      )
    }
    channel.subscribe()

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [profileId, router])

  return null
}
