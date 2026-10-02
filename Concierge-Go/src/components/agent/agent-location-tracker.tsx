'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LocateFixed, MapPinOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { advanceTaskAction } from '@/actions/agent'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/client'
import type { TaskStatus } from '@/types/database'

const TRACKING_STATUSES: TaskStatus[] = ['en_route', 'arrived', 'in_progress']

export function AgentLocationTracker({ taskId, assignmentId, agentId, status }: { taskId: string; assignmentId: string; agentId: string; status: TaskStatus }) {
  const router = useRouter()
  const watchId = useRef<number | null>(null)
  const lastSentAt = useRef(0)
  const [tracking, setTracking] = useState(TRACKING_STATUSES.includes(status))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState(tracking ? 'Requesting precise location…' : 'Tracking has not started.')

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setMessage('Location is not supported on this device.')
      setTracking(false)
      return
    }
    if (watchId.current !== null) return
    const supabase = createClient()
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (now - lastSentAt.current < 8000) return
        lastSentAt.current = now
        const { latitude, longitude, accuracy, heading, speed } = position.coords
        void supabase.from('task_live_locations').upsert({
          task_id: taskId,
          assignment_id: assignmentId,
          agent_id: agentId,
          latitude,
          longitude,
          accuracy_metres: accuracy,
          heading_degrees: heading,
          speed_metres_per_second: speed,
          is_tracking: true,
          recorded_at: new Date(position.timestamp).toISOString(),
        }, { onConflict: 'task_id' }).then(({ error }) => {
          if (error) setMessage('Could not share location. Check your connection and try again.')
          else setMessage(`Live location shared · accuracy about ${Math.round(accuracy)} m`)
        })
      },
      (error) => {
        setMessage(error.code === error.PERMISSION_DENIED ? 'Location permission is off. Allow it in your browser settings.' : 'Waiting for a reliable location signal…')
        setTracking(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
  }, [agentId, assignmentId, taskId])

  useEffect(() => {
    if (tracking && TRACKING_STATUSES.includes(status)) startWatch()
    else stopWatch()
    return stopWatch
  }, [startWatch, status, stopWatch, tracking])

  async function startJourney() {
    setPending(true)
    if (!('geolocation' in navigator)) {
      toast.error('This device does not support location sharing.')
      setPending(false)
      return
    }
    navigator.geolocation.getCurrentPosition(async () => {
      const formData = new FormData()
      formData.set('taskId', taskId)
      const result = await advanceTaskAction(formData)
      setPending(false)
      if (!result.ok) return toast.error(result.error)
      setTracking(true)
      toast.success('Journey started. Your live location is now shared.')
      router.refresh()
    }, (error) => {
      setPending(false)
      toast.error(error.code === error.PERMISSION_DENIED ? 'Allow location access before starting the journey.' : 'We could not get your location. Please try again.')
    }, { enableHighAccuracy: true, timeout: 20000 })
  }

  async function pauseTracking() {
    stopWatch()
    setTracking(false)
    const { error } = await createClient().from('task_live_locations').update({ is_tracking: false, recorded_at: new Date().toISOString() }).eq('task_id', taskId)
    if (error) toast.error('Could not pause tracking.')
    else setMessage('Location sharing paused. Resume before continuing the task.')
  }

  return (
    <div className="space-y-3">
      {status === 'assigned' ? (
        <Button size="lg" className="w-full" loading={pending} onClick={startJourney}>
          <LocateFixed aria-hidden /> Start journey & share live location
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${tracking ? 'animate-pulse bg-success' : 'bg-muted-foreground'}`} /><span>{message}</span></div>
          {tracking ? <Button type="button" variant="outline" size="sm" onClick={pauseTracking}><MapPinOff aria-hidden /> Pause sharing</Button> : <Button type="button" size="sm" onClick={() => setTracking(true)}><LocateFixed aria-hidden /> Resume sharing</Button>}
          <p className="text-xs text-muted-foreground">Keep this installed app or browser page open while travelling for reliable updates.</p>
        </>
      )}
    </div>
  )
}
