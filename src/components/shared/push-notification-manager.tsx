'use client'

import { useEffect, useState } from 'react'
import { BellPlus } from 'lucide-react'

import { publicEnv } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'

function decodeKey(value: string) {
  const padded = value.padEnd(value.length + (4 - value.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0))
}

export function PushNotificationManager() {
  const [available, setAvailable] = useState(false)
  const [subscribed, setSubscribed] = useState(true)

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && Boolean(publicEnv.vapidPublicKey)
    setAvailable(supported)
    if (!supported) return
    void navigator.serviceWorker.register('/sw.js').then((registration) => registration.pushManager.getSubscription()).then((subscription) => setSubscribed(Boolean(subscription))).catch(() => setAvailable(false))
  }, [])

  if (!available || subscribed) return null

  async function enable() {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return toast.error('Notifications were not enabled.')
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicEnv.vapidPublicKey) })
      const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) })
      if (!response.ok) throw new Error('subscribe failed')
      setSubscribed(true)
      toast.success('Task notifications enabled on this device.')
    } catch {
      toast.error('Could not enable notifications on this device.')
    }
  }

  return <Button type="button" variant="ghost" size="icon" aria-label="Enable device notifications" title="Enable device notifications" onClick={enable}><BellPlus aria-hidden /></Button>
}
